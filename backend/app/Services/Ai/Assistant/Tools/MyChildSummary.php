<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Models\Student;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\StudentSummary;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;

/**
 * "How is Lina doing?" — a parent's child at this school: attendance,
 * results, exams to take, fees. Only students whose parent is this user.
 */
class MyChildSummary extends Tool
{
    public function name(): string
    {
        return 'my_child_summary';
    }

    public function describe(): string
    {
        return 'my_child_summary(child?: string) — your child\'s attendance over the last 30 days, recent exam results, exams still to take and fees balance; give the child\'s name if you have more than one.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->hasRole('parent');
    }

    public function rules(): array
    {
        return ['child' => ['nullable', 'string', 'max:100']];
    }

    public function run(ToolContext $context, array $args): array
    {
        $children = $context->children();
        if ($children->isEmpty()) {
            return ['error' => 'No children are linked to your account at this school.'];
        }

        if (filled($args['child'] ?? null)) {
            $needle = Lookup::squash($args['child']);
            $matched = $children->filter(fn (Student $s) => collect([$s->getTranslation('name', 'en', false), $s->getTranslation('name', 'ar', false)])
                ->filter()
                ->contains(fn ($name) => str_contains(Lookup::squash($name), $needle) || str_contains($needle, Lookup::squash($name))));
            $children = $matched->isNotEmpty() ? $matched : $children;
        }

        return [
            'source' => 'your children\'s attendance, exam and fee records',
            'children' => $children->take(3)->map(fn (Student $s) => StudentSummary::build($s, $context))->values()->all(),
            'links' => [
                ['href' => '/parent-attendance', 'label' => 'Attendance'],
                ...($context->hasFeature('fees') ? [['href' => '/parent-fees', 'label' => 'Fees']] : []),
            ],
        ];
    }
}
