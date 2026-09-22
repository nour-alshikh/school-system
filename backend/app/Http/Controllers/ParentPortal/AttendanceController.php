<?php

namespace App\Http\Controllers\ParentPortal;

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
     * This parent's child's full attendance history for their current
     * academic year — read-only, same shape as
     * StudentPortal\AttendanceController.
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
        $student = Student::where('parent_user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
