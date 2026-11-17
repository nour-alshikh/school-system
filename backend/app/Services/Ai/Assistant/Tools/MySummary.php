<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Services\Ai\Assistant\StudentSummary;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;

/** "How am I doing?" — a student's own attendance, results, fees and exams to take. */
class MySummary extends Tool
{
    public function name(): string
    {
        return 'my_summary';
    }

    public function describe(): string
    {
        return 'my_summary() — your attendance over the last 30 days, recent exam results, exams still to take and fees balance.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->student() !== null;
    }

    public function run(ToolContext $context, array $args): array
    {
        return [
            'source' => 'your attendance, exam and fee records',
            ...StudentSummary::build($context->student(), $context),
            'links' => [
                ['href' => '/my-attendance', 'label' => 'My attendance'],
                ['href' => '/my-exams', 'label' => 'My exams'],
            ],
        ];
    }
}
