<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\ExamType;
use App\Models\Exam;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class TeacherExamSummaryType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ExamType $type,
        public readonly ExamStatus $status,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly string $opens_at,
        public readonly string $closes_at,
        public readonly int $submitted_count,
        public readonly int $eligible_count,
    ) {}

    public static function build(Exam $exam, int $eligibleCount): self
    {
        return new self(
            id: $exam->id,
            title: $exam->title,
            type: $exam->type,
            status: $exam->status,
            subject_name_en: $exam->subject->getTranslation('name', 'en'),
            subject_name_ar: $exam->subject->getTranslation('name', 'ar'),
            opens_at: $exam->opens_at->toJSON(),
            closes_at: $exam->closes_at->toJSON(),
            submitted_count: $exam->attempts->where('status', ExamAttemptStatus::Submitted)->count(),
            eligible_count: $eligibleCount,
        );
    }
}
