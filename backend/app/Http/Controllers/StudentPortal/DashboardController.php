<?php

namespace App\Http\Controllers\StudentPortal;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\TypeScript\StudentDashboardType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DashboardController extends Controller
{
    /**
     * Everything the student's own dashboard needs in one fetch — profile,
     * attendance summary/history, classroom subjects+teachers, fees — same
     * single-call shape as StudentPortal\ExamController's endpoints.
     */
    public function show(Request $request)
    {
        $student = $this->student($request);

        return response()->json(['dashboard' => (array) StudentDashboardType::build($student)]);
    }

    private function student(Request $request): Student
    {
        $student = Student::with(['grade', 'classroom', 'academicYear', 'nationality', 'governorate', 'bloodType', 'stage', 'father', 'mother', 'parentUser', 'user'])
            ->where('user_id', $request->user()->id)
            ->first();

        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
