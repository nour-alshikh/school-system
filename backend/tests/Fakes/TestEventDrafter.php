<?php

namespace Tests\Fakes;

use App\Enums\AnnouncementLevel;
use App\Models\Subject;
use App\Models\User;
use App\Services\Ai\Drafter;

/** A draft kind for AiDraftTest, using each of Drafter's helpers. */
class TestEventDrafter extends Drafter
{
    public function kind(): string
    {
        return 'test_event';
    }

    public function authorize(User $user): bool
    {
        return $user->can('manage-calendar');
    }

    public function contextRules(): array
    {
        return ['grade' => ['nullable', 'string', 'max:50']];
    }

    protected function prompt(): string
    {
        return 'Write an event. Reply with JSON only: {"title":{"en":"...","ar":"..."},"description":{"en":"...","ar":"..."},"level":"info","subject_ids":[]}';
    }

    protected function message(string $notes, array $context): string
    {
        return 'Grade: '.($context['grade'] ?? '-')."\nNotes:\n{$notes}";
    }

    protected function shape(array $data): array
    {
        return [
            'title' => $this->bilingual($data, 'title', 100),
            'description' => $this->bilingual($data, 'description', 500, required: false),
            'level' => $this->enumValue($data['level'] ?? null, AnnouncementLevel::class, AnnouncementLevel::Info),
            'subject_ids' => $this->existingIds(Subject::class, $data['subject_ids'] ?? []),
        ];
    }
}
