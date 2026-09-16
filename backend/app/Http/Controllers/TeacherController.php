<?php

namespace App\Http\Controllers;

use App\Enums\TeacherStatus;
use App\Http\Requests\Teacher\StoreTeacherRequest;
use App\Http\Requests\Teacher\UpdateTeacherRequest;
use App\Http\Requests\Teacher\UpdateTeacherSubjectsRequest;
use App\Http\Resources\TeacherResource;
use App\Models\Teacher;
use Illuminate\Http\Request;

class TeacherController extends Controller
{
    public function index(Request $request)
    {
        $query = Teacher::with('subjects')->orderBy('id');

        if ($search = $request->query('search')) {
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if (! $request->has('page')) {
            return response()->json([
                'teachers' => TeacherResource::collection($query->get()),
            ]);
        }

        $teachers = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'teachers' => TeacherResource::collection($teachers),
            'meta' => [
                'current_page' => $teachers->currentPage(),
                'last_page' => $teachers->lastPage(),
                'per_page' => $teachers->perPage(),
                'total' => $teachers->total(),
            ],
        ]);
    }

    public function store(StoreTeacherRequest $request)
    {
        $teacher = Teacher::create($request->validated());

        return response()->json(['teacher' => new TeacherResource($teacher->load('subjects'))], 201);
    }

    /**
     * Going inactive frees up whatever classroom/subject slots this teacher
     * held — nulling teacher_id rather than deleting the rows, so the
     * classroom keeps the subject, it's just unassigned (a still-active
     * teacher can only be assigned subjects they teach, so an inactive one
     * can't stay on the roster there).
     */
    public function update(UpdateTeacherRequest $request, Teacher $teacher)
    {
        $teacher->update($request->validated());

        if ($teacher->status === TeacherStatus::Inactive) {
            $teacher->classroomSubjects()->update(['teacher_id' => null]);
        }

        return response()->json(['teacher' => new TeacherResource($teacher->load('subjects'))]);
    }

    /**
     * Subject assignment is deliberately its own endpoint/page rather than a
     * field on the teacher create/edit form — see TeacherSubjectsPage on the
     * frontend.
     */
    public function updateSubjects(UpdateTeacherSubjectsRequest $request, Teacher $teacher)
    {
        $teacher->subjects()->sync($request->input('subject_ids', []));

        return response()->json(['teacher' => new TeacherResource($teacher->load('subjects'))]);
    }

    public function destroy(Teacher $teacher)
    {
        $teacher->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:teachers,id'],
        ]);

        Teacher::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }
}
