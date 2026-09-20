<?php

namespace App\TypeScript;

use App\Models\ExamQuestion;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentExamQuestionType
{
    public function __construct(
        public readonly int $id,
        public readonly string $text,
        public readonly int $marks,
        /** @var StudentExamOptionType[] */
        public readonly array $options,
        // The option the student already picked, if this attempt is being
        // resumed — null if unanswered so far.
        public readonly ?int $selected_option_id,
    ) {}

    public static function build(ExamQuestion $question, ?int $selectedOptionId): self
    {
        return new self(
            id: $question->id,
            text: $question->text,
            marks: $question->marks,
            options: $question->options->map(StudentExamOptionType::fromModel(...))->all(),
            selected_option_id: $selectedOptionId,
        );
    }
}
