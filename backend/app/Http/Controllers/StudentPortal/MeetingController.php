<?php

namespace App\Http\Controllers\StudentPortal;

use App\Http\Controllers\Controller;
use App\Models\Meeting;
use App\Models\Student;
use App\TypeScript\StudentMeetingType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class MeetingController extends Controller
{
    /**
     * Meetings assigned to this student's classroom for their current
     * academic year — same eligibility shape as StudentPortal\ExamController,
     * minus the grade-wide option (a meeting always targets specific
     * classrooms, see Meeting::classrooms()).
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $meetings = Meeting::with('creator')
            ->where('academic_year_id', $student->academic_year_id)
            ->whereHas('classrooms', fn ($q) => $q->where('classroom_id', $student->classroom_id))
            ->orderByDesc('start_time')
            ->get();

        return response()->json([
            'meetings' => $meetings->map(fn (Meeting $meeting) => StudentMeetingType::fromModel($meeting))->values()->all(),
        ]);
    }

    private function student(Request $request): Student
    {
        $student = Student::where('user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
