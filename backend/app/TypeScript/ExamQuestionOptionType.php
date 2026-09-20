<?php

namespace App\TypeScript;

use App\Models\ExamQuestionOption;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The teacher/admin-facing shape, including is_correct — never sent to a
 * student. See StudentExamOptionType for the answer-key-free counterpart
 * used while a student is taking the exam.
 */
#[TypeScript]
final class ExamQuestionOptionType
{
    public function __construct(
        public readonly int $id,
        public readonly string $text,
        public readonly bool $is_correct,
        public readonly int $order,
    ) {}

    public static function fromModel(ExamQuestionOption $option): self
    {
        return new self(
            id: $option->id,
            text: $option->text,
            is_correct: $option->is_correct,
            order: $option->order,
        );
    }
}
