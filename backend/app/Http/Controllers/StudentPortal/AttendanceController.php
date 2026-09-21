<?php

namespace App\Http\Controllers\StudentPortal;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Student;
use App\TypeScript\AttendanceRecordType;
use App\TypeScript\StudentAttendanceSummaryType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttendanceController extends Controller
{
    /**
     * This student's full attendance history for their current academic
     * year — the dashboard only shows the summary/latest record, this is
     * what its "view history" link leads to.
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $records = Attendance::with('student')
            ->where('student_id', $student->id)
            ->where('academic_year_id', $student->academic_year_id)
            ->orderByDesc('date')
            ->get();

        return response()->json([
            'summary' => (array) StudentAttendanceSummaryType::fromRecords($records),
            'records' => $records->map(fn (Attendance $a) => AttendanceRecordType::fromModel($a))->values()->all(),
        ]);
    }

    private function student(Request $request): Student
    {
        $student = Student::where('user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
