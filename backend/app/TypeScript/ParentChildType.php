<?php

namespace App\TypeScript;

use App\Models\Attendance;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One child on the parent dashboard's overview. Built inside the child's
 * school context (see ParentPortal\StudentController::index).
 */
#[TypeScript]
final class ParentChildType
{
    public function __construct(
        public readonly StudentType $student,
        public readonly int $school_id,
        public readonly string $school_name,
        public readonly StudentAttendanceSummaryType $attendance,
        public readonly StudentFeesSummaryType $fees,
    ) {}

    public static function fromModel(Student $student): self
    {
        $attendance = Attendance::where('student_id', $student->id)
            ->where('academic_year_id', $student->academic_year_id)
            ->get();

        return new self(
            student: StudentType::fromModel($student),
            school_id: $student->school_id,
            school_name: $student->school->name,
            attendance: StudentAttendanceSummaryType::fromRecords($attendance),
            fees: StudentFeesSummaryType::fromCharges($student->feeCharges()->with('payments')->get()),
        );
    }
}
