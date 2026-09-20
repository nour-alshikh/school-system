<?php

namespace App\TypeScript;

use App\Models\Exam;
use App\Models\ExamAttempt;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * What the student sees while actively taking the exam. remaining_seconds
 * is computed server-side (started_at + duration_minutes, capped by
 * closes_at) so a student can't extend their own time by tampering with
 * the client clock — see StudentPortal\ExamController::show().
 */
#[TypeScript]
final class StudentExamAttemptType
{
    public function __construct(
        public readonly int $attempt_id,
        public readonly int $exam_id,
        public readonly string $title,
        public readonly ?string $instructions,
        public readonly int $duration_minutes,
        public readonly int $remaining_seconds,
        /** @var StudentExamQuestionType[] */
        public readonly array $questions,
    ) {}

    public static function build(Exam $exam, ExamAttempt $attempt, int $remainingSeconds): self
    {
        $selectedByQuestion = $attempt->answers->pluck('selected_option_id', 'question_id');

        return new self(
            attempt_id: $attempt->id,
            exam_id: $exam->id,
            title: $exam->title,
            instructions: $exam->instructions,
            duration_minutes: $exam->duration_minutes,
            remaining_seconds: $remainingSeconds,
            questions: $exam->questions
                ->map(fn ($question) => StudentExamQuestionType::build(
                    $question,
                    $selectedByQuestion->get($question->id)
                ))
                ->all(),
        );
    }
}
