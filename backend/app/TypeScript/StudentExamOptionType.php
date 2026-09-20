<?php

namespace App\TypeScript;

use App\Models\ExamQuestionOption;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * Deliberately omits is_correct — this is what a student sees while taking
 * the exam. See ExamQuestionOptionType for the admin/teacher shape.
 */
#[TypeScript]
final class StudentExamOptionType
{
    public function __construct(
        public readonly int $id,
        public readonly string $text,
    ) {}

    public static function fromModel(ExamQuestionOption $option): self
    {
        return new self(
            id: $option->id,
            text: $option->text,
        );
    }
}
