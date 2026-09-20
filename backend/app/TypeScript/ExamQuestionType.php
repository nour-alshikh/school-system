<?php

namespace App\TypeScript;

use App\Models\ExamQuestion;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ExamQuestionType
{
    public function __construct(
        public readonly int $id,
        public readonly string $text,
        public readonly int $marks,
        public readonly int $order,
        /** @var ExamQuestionOptionType[] */
        public readonly array $options,
    ) {}

    public static function fromModel(ExamQuestion $question): self
    {
        return new self(
            id: $question->id,
            text: $question->text,
            marks: $question->marks,
            order: $question->order,
            options: $question->options->map(ExamQuestionOptionType::fromModel(...))->all(),
        );
    }
}
