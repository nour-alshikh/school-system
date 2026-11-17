<?php

namespace App\Services\Ai\Drafts;

use App\Models\User;
use App\Services\Ai\Drafter;
use Carbon\CarbonImmutable;

/**
 * Online lessons (docs/ai-assistant-plan.md, phase 3): "Revision for the
 * maths exam, grade 9" → title and an agenda, plus a start time and length
 * when the notes give them. Classrooms stay the user's pick.
 */
class MeetingDrafter extends Drafter
{
    public function kind(): string
    {
        return 'meeting';
    }

    public function authorize(User $user): bool
    {
        // Same as the meeting routes: role_or_permission:teacher|manage-meetings.
        return $user->can('manage-meetings') || $user->hasRole('teacher');
    }

    public function planFeature(): ?string
    {
        return 'meetings';
    }

    protected function prompt(): string
    {
        return <<<TXT
            You prepare online lessons for a school. From the notes, write a short title (under 80 characters) and a description: one sentence saying what the lesson is for, then a short agenda of 3-5 points, one per line starting with "- ".
            Today is {$this->today()}. If the notes give a day and time, give start_time as YYYY-MM-DDTHH:MM (24-hour); otherwise null. If they give a length, duration_minutes as a number; otherwise null.
            {$this->sameLanguage()}
            Reply with JSON only, no other text: {"title":"...","description":"...","start_time":null,"duration_minutes":null}
            TXT;
    }

    protected function shape(array $data): array
    {
        $duration = filter_var($data['duration_minutes'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 5, 'max_range' => 600]]);

        return [
            'title' => $this->text($data, 'title', 255, required: true),
            'description' => $this->text($data, 'description', 5000) ?? '',
            'start_time' => $this->startTime($data['start_time'] ?? null),
            'duration_minutes' => $duration === false ? null : $duration,
        ];
    }

    /** YYYY-MM-DDTHH:MM, from today to a year ahead, else null. */
    private function startTime(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $value)) {
            return null;
        }

        $time = CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $value);

        return $time && $time->format('Y-m-d\TH:i') === $value && $time->isAfter(now()->startOfDay()) && $time->isBefore(now()->addYear()) ? $value : null;
    }
}
