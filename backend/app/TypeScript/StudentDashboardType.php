<?php

namespace App\TypeScript;

use App\Models\Attendance;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The dashboard's landing summary — latest/aggregate figures only. Full
 * history and listings live behind their own endpoints/pages (see
 * StudentPortal\AttendanceController, SubjectController, FeeController) so
 * this stays a fast, small fetch.
 */
#[TypeScript]
final class StudentDashboardType
{
    public function __construct(
        public readonly StudentType $student,
        public readonly StudentAttendanceSummaryType $attendance_summary,
        public readonly ?AttendanceRecordType $latest_attendance,
        public readonly int $subjects_count,
        public readonly StudentFeesSummaryType $fees_summary,
    ) {}

    public static function build(Student $student): self
    {
        $attendanceRecords = Attendance::with('student')
            ->where('student_id', $student->id)
            ->where('academic_year_id', $student->academic_year_id)
            ->orderByDesc('date')
            ->get();

        $subjectsCount = $student->classroom ? $student->classroom->subjectTeachers()->count() : 0;

        $feeCharges = $student->feeCharges;

        return new self(
            student: StudentType::fromModel($student),
            attendance_summary: StudentAttendanceSummaryType::fromRecords($attendanceRecords),
            latest_attendance: $attendanceRecords->first()
                ? AttendanceRecordType::fromModel($attendanceRecords->first())
                : null,
            subjects_count: $subjectsCount,
            fees_summary: StudentFeesSummaryType::fromCharges($feeCharges),
        );
    }
}
