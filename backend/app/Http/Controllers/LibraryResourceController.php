<?php

namespace App\Http\Controllers;

use App\Enums\LibraryResourceKind;
use App\Http\Requests\LibraryResource\StoreLibraryResourceRequest;
use App\Http\Requests\LibraryResource\UpdateLibraryResourceFileRequest;
use App\Http\Requests\LibraryResource\UpdateLibraryResourceRequest;
use App\Http\Resources\GradeResource;
use App\Http\Resources\LibraryResourceResource;
use App\Http\Resources\SubjectResource;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\LibraryResource as LibraryResourceModel;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class LibraryResourceController extends Controller
{
    private const WITH = ['grade', 'subjects', 'uploader', 'media'];

    /**
     * Admin (manage-academics) sees every grade's resources; a teacher only
     * sees resources in grades they hold a subject slot in — same "own
     * scope" convention as MeetingController::index().
     */
    public function index(Request $request)
    {
        $query = LibraryResourceModel::with(self::WITH)->orderByDesc('id');

        $this->scopeToOwnGrades($request, $query);

        if ($gradeId = $request->query('grade_id')) {
            $query->where('grade_id', $gradeId);
        }

        if ($subjectId = $request->query('subject_id')) {
            $query->whereHas('subjects', fn ($q) => $q->where('subjects.id', $subjectId));
        }

        return response()->json(['library_resources' => LibraryResourceResource::collection($query->get())]);
    }

    /**
     * Which grades the current user may post a resource for — same idea as
     * MeetingController::classrooms(), one level up (grade instead of
     * classroom).
     */
    public function grades(Request $request)
    {
        $user = $request->user();
        $query = Grade::with('stage')->orderBy('id');

        if (! $user->can('manage-academics')) {
            $teacher = $user->teacher;
            abort_if(! $teacher, Response::HTTP_FORBIDDEN);

            $query->whereIn('id', $this->teacherGradeIds($teacher));
        }

        return response()->json(['grades' => GradeResource::collection($query->get())]);
    }

    /**
     * The subjects available to tag a resource in a given grade — scoped
     * the same way SubjectController::index()'s grade_id filter is (a
     * subject taught directly in the grade, or across its whole stage), so
     * a teacher without manage-academics/manage-students (which gate
     * `/api/subjects`) still has a source for the tag picker.
     */
    public function subjects(Request $request)
    {
        $gradeId = $request->query('grade_id');
        abort_if(! $gradeId, Response::HTTP_UNPROCESSABLE_ENTITY);

        $this->authorizeGrade($request, (int) $gradeId);

        $grade = Grade::findOrFail($gradeId);

        $subjects = Subject::where(function ($q) use ($gradeId, $grade) {
            $q->whereHas('grades', fn ($qq) => $qq->where('grades.id', $gradeId))
                ->orWhereHas('stages', fn ($qq) => $qq->where('stages.id', $grade->stage_id));
        })->orderBy('id')->get();

        return response()->json(['subjects' => SubjectResource::collection($subjects)]);
    }

    public function store(StoreLibraryResourceRequest $request)
    {
        $data = $request->validated();
        $this->authorizeGrade($request, $data['grade_id']);

        $resource = DB::transaction(function () use ($data, $request) {
            $resource = LibraryResourceModel::create([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'type' => $data['type'],
                'url' => $data['type'] === LibraryResourceKind::Link->value ? $data['url'] : null,
                'grade_id' => $data['grade_id'],
                'uploaded_by' => $request->user()->id,
            ]);

            $resource->subjects()->sync($data['subject_ids'] ?? []);

            if ($data['type'] === LibraryResourceKind::File->value && $request->hasFile('file')) {
                $resource->addMediaFromRequest('file')->toMediaCollection('file');
            }

            return $resource;
        });

        return response()->json(['library_resource' => new LibraryResourceResource($resource->load(self::WITH))], 201);
    }

    public function update(UpdateLibraryResourceRequest $request, LibraryResourceModel $libraryResource)
    {
        $this->authorizeManage($request, $libraryResource);

        $data = $request->validated();
        $this->authorizeGrade($request, $data['grade_id']);

        $libraryResource->update([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'type' => $data['type'],
            'url' => $data['type'] === LibraryResourceKind::Link->value ? $data['url'] : null,
            'grade_id' => $data['grade_id'],
        ]);

        $libraryResource->subjects()->sync($data['subject_ids'] ?? []);

        return response()->json(['library_resource' => new LibraryResourceResource($libraryResource->load(self::WITH))]);
    }

    /**
     * Replacing the uploaded file is its own endpoint rather than a field on
     * the metadata update — see UpdateLibraryResourceRequest's doc comment.
     * The media collection is singleFile(), so this replaces whatever was
     * there before automatically.
     */
    public function updateFile(UpdateLibraryResourceFileRequest $request, LibraryResourceModel $libraryResource)
    {
        $this->authorizeManage($request, $libraryResource);

        $libraryResource->addMediaFromRequest('file')->toMediaCollection('file');

        return response()->json(['library_resource' => new LibraryResourceResource($libraryResource->load(self::WITH))]);
    }

    public function destroy(Request $request, LibraryResourceModel $libraryResource)
    {
        $this->authorizeManage($request, $libraryResource);

        $libraryResource->delete();

        return response()->noContent();
    }

    /**
     * Shared by every role that can see the resource (admin, teacher,
     * student, parent) — route middleware alone can't express that split,
     * so this checks it directly. See authorizeView().
     */
    public function download(Request $request, LibraryResourceModel $libraryResource): BinaryFileResponse
    {
        $this->authorizeView($request, $libraryResource);

        $media = $libraryResource->getFirstMedia('file');
        abort_if(! $media, Response::HTTP_NOT_FOUND);

        return response()->download($media->getPath(), $media->file_name);
    }

    /**
     * Admin sees everything; a teacher is narrowed to grades they hold a
     * subject slot in.
     */
    private function scopeToOwnGrades(Request $request, $query): void
    {
        $user = $request->user();

        if ($user->can('manage-academics')) {
            return;
        }

        $teacher = $user->teacher;
        abort_if(! $teacher, Response::HTTP_FORBIDDEN);

        $query->whereIn('grade_id', $this->teacherGradeIds($teacher));
    }

    /**
     * A teacher may only target grades they hold a subject slot in — same
     * idea as MeetingController::authorizeClassrooms(), one level up.
     */
    private function authorizeGrade(Request $request, int $gradeId): void
    {
        $user = $request->user();

        if ($user->can('manage-academics')) {
            return;
        }

        $teacher = $user->teacher;
        abort_if(! $teacher, Response::HTTP_FORBIDDEN);

        abort_if(! $this->teacherGradeIds($teacher)->contains($gradeId), Response::HTTP_FORBIDDEN);
    }

    private function authorizeManage(Request $request, LibraryResourceModel $libraryResource): void
    {
        $user = $request->user();

        if ($user->can('manage-academics')) {
            return;
        }

        abort_if($libraryResource->uploaded_by !== $user->id, Response::HTTP_FORBIDDEN);
    }

    /**
     * Read access for download(): admin, a teacher holding a subject slot in
     * the resource's grade, the student in that grade, or that student's
     * parent.
     */
    private function authorizeView(Request $request, LibraryResourceModel $libraryResource): void
    {
        $user = $request->user();

        if ($user->can('manage-academics')) {
            return;
        }

        if ($teacher = $user->teacher) {
            abort_if(! $this->teacherGradeIds($teacher)->contains($libraryResource->grade_id), Response::HTTP_FORBIDDEN);

            return;
        }

        $student = Student::where('user_id', $user->id)->first();
        if ($student) {
            abort_if($student->grade_id !== $libraryResource->grade_id, Response::HTTP_FORBIDDEN);

            return;
        }

        $child = Student::where('parent_user_id', $user->id)->first();
        if ($child) {
            abort_if($child->grade_id !== $libraryResource->grade_id, Response::HTTP_FORBIDDEN);

            return;
        }

        abort(Response::HTTP_FORBIDDEN);
    }

    private function teacherGradeIds(Teacher $teacher)
    {
        $classroomIds = $teacher->classroomSubjects()->pluck('classroom_id')->unique();

        return Classroom::whereIn('id', $classroomIds)->pluck('grade_id')->unique();
    }
}
