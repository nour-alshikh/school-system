<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamType as ExamTypeEnum;
use App\Models\Exam;
use App\Models\ExamAttempt;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentExamListEntryType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ExamTypeEnum $type,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly int $duration_minutes,
        public readonly string $opens_at,
        public readonly string $closes_at,
        // Null = not started yet.
        public readonly ?ExamAttemptStatus $attempt_status,
        // Only meaningful once attempt_status is Submitted.
        public readonly ?int $score,
        public readonly int $total_marks,
    ) {}

    public static function build(Exam $exam, ?ExamAttempt $attempt): self
    {
        return new self(
            id: $exam->id,
            title: $exam->title,
            type: $exam->type,
            subject_name_en: $exam->subject->getTranslation('name', 'en'),
            subject_name_ar: $exam->subject->getTranslation('name', 'ar'),
            duration_minutes: $exam->duration_minutes,
            opens_at: $exam->opens_at->toJSON(),
            closes_at: $exam->closes_at->toJSON(),
            attempt_status: $attempt?->status,
            score: $attempt?->score,
            total_marks: $exam->questions->sum('marks'),
        );
    }
}
