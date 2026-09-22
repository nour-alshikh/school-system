<?php

namespace App\Http\Controllers\StudentPortal;

use App\Http\Controllers\Controller;
use App\Http\Resources\LibraryResourceResource;
use App\Models\LibraryResource;
use App\Models\Student;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LibraryController extends Controller
{
    /**
     * Library resources tagged to this student's own grade — read-only,
     * same shape as StudentPortal\SubjectController.
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

    private function student(Request $request): Student
    {
        $student = Student::where('user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
