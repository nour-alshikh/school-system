<?php

namespace App\Services\Ai\Drafts;

use App\Models\Grade;
use App\Models\Subject;
use App\Models\User;
use App\Services\Ai\Drafter;
use RuntimeException;

/**
 * Exam builder (docs/ai-assistant-plan.md, phase 3): "10 MCQs on fractions
 * for Grade 4, medium", or a pasted lesson → multiple-choice questions with
 * one correct option each. The form appends them to the exam's questions;
 * it never replaces the ones already there. The exam's subject and grade
 * (names only) go along as context.
 */
class ExamQuestionsDrafter extends Drafter
{
    public const MAX_QUESTIONS = 20;

    protected float $temperature = 0.5;

    protected int $maxTokens = 5000;

    public function kind(): string
    {
        return 'exam_questions';
    }

    public function authorize(User $user): bool
    {
        // Same as the exam routes: role_or_permission:teacher|manage-exams.
        return $user->can('manage-exams') || $user->hasRole('teacher');
    }

    public function planFeature(): ?string
    {
        return 'exams';
    }

    public function contextRules(): array
    {
        return [
            'subject_id' => ['nullable', 'integer', 'exists:subjects,id'],
            'grade_id' => ['nullable', 'integer', 'exists:grades,id'],
        ];
    }

    protected function prompt(): string
    {
        $max = self::MAX_QUESTIONS;

        return <<<TXT
            You write multiple-choice questions for school exams. From the teacher's request (or the lesson text they paste), write the questions it asks for — at most {$max}; if no number is given, write 5.
            Each question has 2 to 6 short options with exactly one correct answer ("correct" is its 0-based index), and marks (1 unless the request says otherwise). Pitch them at the grade given. Questions must be answerable from general knowledge of the subject or from the pasted text; don't make up facts.
            {$this->sameLanguage()}
            Also suggest a short exam title and one sentence of instructions for students.
            Reply with JSON only, no other text: {"title":"...","instructions":"...","questions":[{"text":"...","options":["...","..."],"correct":0,"marks":1}]}
            TXT;
    }

    protected function message(string $notes, array $context): string
    {
        $about = array_filter([
            'Subject' => isset($context['subject_id']) ? Subject::find($context['subject_id'])?->getTranslation('name', 'en') : null,
            'Grade' => isset($context['grade_id']) ? Grade::find($context['grade_id'])?->getTranslation('name', 'en') : null,
        ]);

        return collect($about)->map(fn ($v, $k) => "{$k}: {$v}")->push("Request:\n{$notes}")->implode("\n");
    }

    /** Questions without a valid correct option, or with fewer than two options, are dropped. */
    protected function shape(array $data): array
    {
        $questions = [];

        foreach (is_array($data['questions'] ?? null) ? $data['questions'] : [] as $row) {
            if (count($questions) === self::MAX_QUESTIONS || ! is_array($row)) {
                continue;
            }

            $text = $this->text($row, 'text', 2000);
            $options = array_values(array_filter(array_map(
                fn ($o) => is_scalar($o) ? mb_substr(trim((string) $o), 0, 255) : (is_array($o) && is_scalar($o['text'] ?? null) ? mb_substr(trim((string) $o['text']), 0, 255) : ''),
                array_slice(is_array($row['options'] ?? null) ? $row['options'] : [], 0, 6),
            ), fn ($o) => $o !== ''));
            $correct = filter_var($row['correct'] ?? null, FILTER_VALIDATE_INT);
            $marks = filter_var($row['marks'] ?? 1, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);

            if ($text !== null && count($options) >= 2 && $correct !== false && isset($options[$correct])) {
                $questions[] = ['text' => $text, 'options' => $options, 'correct' => $correct, 'marks' => $marks ?: 1];
            }
        }

        if ($questions === []) {
            throw new RuntimeException('Draft has no usable questions');
        }

        return [
            'title' => $this->text($data, 'title', 255),
            'instructions' => $this->text($data, 'instructions', 1000),
            'questions' => $questions,
        ];
    }
}
