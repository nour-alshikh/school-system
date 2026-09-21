<?php

namespace App\Http\Controllers\StudentPortal;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\TypeScript\StudentClassSubjectType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SubjectController extends Controller
{
    /**
     * The subjects taught in this student's classroom, each with its
     * teacher — the dashboard only shows a count, this is what its "view
     * subjects" link leads to.
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $assignments = $student->classroom
            ? $student->classroom->subjectTeachers()->with(['subject', 'teacher'])->get()
            : collect();

        return response()->json([
            'subjects' => $assignments
                ->map(fn ($assignment) => StudentClassSubjectType::fromModel($assignment))
                ->values()
                ->all(),
        ]);
    }

    private function student(Request $request): Student
    {
        $student = Student::with('classroom')->where('user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
