<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Http\Resources\LibraryResourceResource;
use App\Models\LibraryResource;
use App\Models\Student;
use App\Services\ParentChildren;
use Illuminate\Http\Request;

class LibraryController extends Controller
{
    /**
     * Library resources tagged to one of this parent's children's grade — read-only,
     * same shape as ParentPortal\StudentController.
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $query = LibraryResource::with(['grade', 'subjects', 'uploader', 'media'])
            ->where('grade_id', $student->grade_id)
            ->orderByDesc('id');

        if ($subjectId = $request->query('subject_id')) {
            $query->whereHas('subjects', fn ($q) => $q->where('subjects.id', $subjectId));
        }

        return response()->json(['library_resources' => LibraryResourceResource::collection($query->get())]);
    }

    /** ?student_id picks the child (any of theirs, at any of their schools). */
    private function student(Request $request): Student
    {
        return app(ParentChildren::class)->resolve($request->user(), $request->integer('student_id') ?: null);
    }
}
