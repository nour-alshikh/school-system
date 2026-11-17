<?php

namespace App\TypeScript;

use App\Models\ExamAttempt;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A submitted exam attempt's result, for score trends and "latest grades". */
#[TypeScript]
final class DashboardExamScoreType
{
    public function __construct(
        public readonly int $exam_id,
        public readonly string $title,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly int $score,
        public readonly int $total_marks,
        /** 0–100, one decimal. */
        public readonly float $percent,
        public readonly string $submitted_at,
    ) {}

    /** Needs `exam.subject` and `exam.questions` loaded. */
    public static function fromAttempt(ExamAttempt $attempt): self
    {
        $exam = $attempt->exam;
        $total = (int) $exam->questions->sum('marks');
        $score = (int) $attempt->score;

        return new self(
            exam_id: $exam->id,
            title: $exam->title,
            subject_name_en: $exam->subject->getTranslation('name', 'en'),
            subject_name_ar: $exam->subject->getTranslation('name', 'ar'),
            score: $score,
            total_marks: $total,
            percent: $total > 0 ? round($score / $total * 100, 1) : 0.0,
            submitted_at: $attempt->submitted_at->toJSON(),
        );
    }
}
