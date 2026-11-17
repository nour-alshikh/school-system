<?php

namespace App\Services\Ai\Assistant\Actions;

use App\Services\Ai\Assistant\Action;
use App\Services\Ai\Assistant\ToolContext;

/**
 * "Make a 10-question quiz on fractions" → opens the exam builder with the
 * request in its "Draft with AI" box (phase 3), where the user picks the
 * subject and class, drafts, reviews and saves.
 */
class DraftExam extends Action
{
    public function name(): string
    {
        return 'draft_exam';
    }

    public function describe(): string
    {
        return 'draft_exam(request: string, title?: string) — opens the exam builder with this request ready for "Draft with AI" (e.g. "10 multiple-choice questions on fractions for grade 4, medium").';
    }

    public function allows(ToolContext $context): bool
    {
        return ($context->can('manage-exams') || $context->teacher() !== null) && $context->hasFeature('exams');
    }

    public function rules(): array
    {
        return [
            'request' => ['required', 'string', 'max:2000'],
            'title' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function prepare(ToolContext $context, array $fields): array
    {
        return [
            'fields' => [
                'request' => trim($fields['request']),
                'title' => filled($fields['title'] ?? null) ? trim($fields['title']) : null,
            ],
        ];
    }
}
