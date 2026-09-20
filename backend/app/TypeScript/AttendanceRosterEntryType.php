<?php

namespace App\TypeScript;

use App\Enums\AttendanceStatus;
use App\Models\Attendance;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One row of the classroom-marking screen: a student paired with whatever
 * attendance record already exists for the requested date, if any. Not a
 * single-model DTO (see FeeMatchingStudentType for the same "narrower than
 * the full model" idea) — AttendanceController::index() builds one of these
 * per active student in the classroom, present or not yet marked.
 */
#[TypeScript]
final class AttendanceRosterEntryType
{
    public function __construct(
        public readonly int $student_id,
        public readonly string $student_name_en,
        public readonly string $student_name_ar,
        public readonly ?int $attendance_id,
        public readonly ?AttendanceStatus $status,
        public readonly ?string $notes,
    ) {}

    public static function build(Student $student, ?Attendance $attendance): self
    {
        return new self(
            student_id: $student->id,
            student_name_en: $student->getTranslation('name', 'en'),
            student_name_ar: $student->getTranslation('name', 'ar'),
            attendance_id: $attendance?->id,
            status: $attendance?->status,
            notes: $attendance?->notes,
        );
    }
}
