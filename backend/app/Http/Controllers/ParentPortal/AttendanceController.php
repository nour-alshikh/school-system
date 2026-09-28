<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Student;
use App\Services\ParentChildren;
use App\TypeScript\AttendanceRecordType;
use App\TypeScript\StudentAttendanceSummaryType;
use Illuminate\Http\Request;

class AttendanceController extends Controller
{
    /**
     * One of this parent's children's full attendance history for their current
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

    /** ?student_id picks the child (any of theirs, at any of their schools). */
    private function student(Request $request): Student
    {
        return app(ParentChildren::class)->resolve($request->user(), $request->integer('student_id') ?: null);
    }
}
