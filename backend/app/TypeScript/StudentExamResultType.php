<?php

namespace App\TypeScript;

use App\Models\ExamAttempt;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentExamResultType
{
    public function __construct(
        public readonly int $score,
        public readonly int $total_marks,
        public readonly string $submitted_at,
    ) {}

    public static function fromModel(ExamAttempt $attempt): self
    {
        return new self(
            score: $attempt->score ?? 0,
            total_marks: $attempt->exam->questions->sum('marks'),
            submitted_at: $attempt->submitted_at->toJSON(),
        );
    }
}
