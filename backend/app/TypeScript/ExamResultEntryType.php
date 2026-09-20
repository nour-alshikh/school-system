<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Models\ExamAttempt;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One row of the teacher/admin results roster: an eligible student paired
 * with whatever attempt exists for them, if any — same "student + maybe a
 * record" shape as AttendanceRosterEntryType.
 */
#[TypeScript]
final class ExamResultEntryType
{
    public function __construct(
        public readonly int $student_id,
        public readonly string $student_name_en,
        public readonly string $student_name_ar,
        public readonly ?ExamAttemptStatus $status,
        public readonly ?int $score,
        public readonly ?string $submitted_at,
    ) {}

    public static function build(Student $student, ?ExamAttempt $attempt): self
    {
        return new self(
            student_id: $student->id,
            student_name_en: $student->getTranslation('name', 'en'),
            student_name_ar: $student->getTranslation('name', 'ar'),
            status: $attempt?->status,
            score: $attempt?->score,
            submitted_at: $attempt?->submitted_at?->toJSON(),
        );
    }
}
