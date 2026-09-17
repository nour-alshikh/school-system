<?php

namespace App\Http\Controllers;

use App\Enums\StudentStatus;
use App\Http\Requests\Student\StoreStudentAttachmentsRequest;
use App\Http\Requests\Student\StoreStudentRequest;
use App\Http\Requests\Student\UpdateStudentRequest;
use App\Http\Resources\StudentResource;
use App\Models\Student;
use App\Services\StudentService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class StudentController extends Controller
{
    private const WITH = [
        'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom', 'academicYear',
        'nationality', 'governorate', 'bloodType', 'media',
    ];

    public function __construct(private readonly StudentService $studentService) {}

    public function index(Request $request)
    {
        $query = Student::with(self::WITH)->orderBy('id');

        // Defaults to the active roster — a graduated student stays on
        // their last classroom_id/grade_id/etc. forever (see
        // GraduationService::graduate), so every other caller of this
        // endpoint (promotion/graduation source pickers, the students
        // index) would otherwise keep surfacing them. status=all or
        // status=graduated opts out explicitly.
        $status = $request->query('status', StudentStatus::Active->value);
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($search = $request->query('search')) {
            $escaped = addcslashes($search, '%_\\');
            $query->where(function ($q) use ($escaped) {
                $q->where('name->en', 'like', "%{$escaped}%")
                    ->orWhere('name->ar', 'like', "%{$escaped}%")
                    ->orWhereHas('user', function ($userQuery) use ($escaped) {
                        $userQuery->where('email', 'like', "%{$escaped}%");
                    });
            });
        }

        if ($stageId = $request->query('stage_id')) {
            $query->where('stage_id', $stageId);
        }

        if ($gradeId = $request->query('grade_id')) {
            $query->where('grade_id', $gradeId);
        }

        if ($classroomId = $request->query('classroom_id')) {
            $query->where('classroom_id', $classroomId);
        }

        if ($academicYearId = $request->query('academic_year_id')) {
            $query->where('academic_year_id', $academicYearId);
        }

        if (! $request->has('page')) {
            return response()->json([
                'students' => StudentResource::collection($query->get()),
            ]);
        }

        $students = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'students' => StudentResource::collection($students),
            'meta' => [
                'current_page' => $students->currentPage(),
                'last_page' => $students->lastPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
            ],
        ]);
    }

    public function store(StoreStudentRequest $request)
    {
        $student = $this->studentService->register($request);

        return response()->json(['student' => new StudentResource($student)], 201);
    }

    public function show(Student $student)
    {
        $student->load(self::WITH);

        return response()->json(['student' => new StudentResource($student)]);
    }

    public function update(UpdateStudentRequest $request, Student $student)
    {
        $student = $this->studentService->update($student, $request);

        return response()->json(['student' => new StudentResource($student)]);
    }

    public function destroy(Student $student)
    {
        $this->studentService->delete($student);

        return response()->noContent();
    }

    /**
     * Attachments are edited outside the main update() payload — that one's
     * plain JSON (see StudentService::update), so files get their own
     * multipart endpoints instead of forcing the whole edit form onto
     * FormData just for this one field.
     */
    public function storeAttachments(StoreStudentAttachmentsRequest $request, Student $student)
    {
        foreach ($request->file('attachments', []) as $attachment) {
            $student->addMedia($attachment)->toMediaCollection('attachments');
        }

        return response()->json(['student' => new StudentResource($student->load(self::WITH))]);
    }

    public function destroyAttachment(Student $student, Media $media)
    {
        $this->authorizeAttachment($student, $media);

        $media->delete();

        return response()->json(['student' => new StudentResource($student->load(self::WITH))]);
    }

    public function downloadAttachment(Student $student, Media $media): BinaryFileResponse
    {
        $this->authorizeAttachment($student, $media);

        return response()->download($media->getPath(), $media->file_name);
    }

    /**
     * Media rows aren't scoped to a student by the route itself — the
     * {media} segment is a bare primary key — so this closes the gap: a
     * mismatched student/media pair (wrong student, wrong collection, or a
     * media row belonging to some other model entirely) 404s instead of
     * leaking or deleting the wrong file.
     */
    private function authorizeAttachment(Student $student, Media $media): void
    {
        if (
            $media->model_type !== Student::class
            || $media->model_id !== $student->id
            || $media->collection_name !== 'attachments'
        ) {
            abort(Response::HTTP_NOT_FOUND);
        }
    }
}
