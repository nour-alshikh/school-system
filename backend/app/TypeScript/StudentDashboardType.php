<?php

namespace App\TypeScript;

use App\Models\Attendance;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentDashboardType
{
    public function __construct(
        public readonly StudentType $student,
        public readonly StudentAttendanceSummaryType $attendance_summary,
        /** @var AttendanceRecordType[] */
        public readonly array $recent_attendance,
        /** @var StudentClassSubjectType[] */
        public readonly array $subjects,
        /** @var FeeChargeType[] */
        public readonly array $fee_charges,
        public readonly StudentFeesSummaryType $fees_summary,
    ) {}

    public static function build(Student $student): self
    {
        $attendanceRecords = Attendance::with('student')
            ->where('student_id', $student->id)
            ->where('academic_year_id', $student->academic_year_id)
            ->orderByDesc('date')
            ->get();

        $subjectAssignments = $student->classroom
            ? $student->classroom->subjectTeachers()->with(['subject', 'teacher'])->get()
            : collect();

        $feeCharges = $student->feeCharges()->with(['fee', 'payments.recordedBy'])->orderByDesc('id')->get();

        return new self(
            student: StudentType::fromModel($student),
            attendance_summary: StudentAttendanceSummaryType::fromRecords($attendanceRecords),
            recent_attendance: $attendanceRecords
                ->take(20)
                ->map(fn (Attendance $a) => AttendanceRecordType::fromModel($a))
                ->values()
                ->all(),
            subjects: $subjectAssignments
                ->map(fn ($assignment) => StudentClassSubjectType::fromModel($assignment))
                ->values()
                ->all(),
            fee_charges: $feeCharges
                ->map(fn ($charge) => FeeChargeType::fromModel($charge))
                ->values()
                ->all(),
            fees_summary: StudentFeesSummaryType::fromCharges($feeCharges),
        );
    }
}
