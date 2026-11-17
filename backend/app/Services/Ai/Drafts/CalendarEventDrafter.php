<?php

namespace App\Services\Ai\Drafts;

use App\Models\User;
use App\Services\Ai\Drafter;
use Carbon\CarbonImmutable;

/**
 * Calendar (docs/ai-assistant-plan.md, phase 3): "Sports day next Thursday
 * for primary, parents welcome" → title, description and date. The model
 * resolves relative dates from today's date in the prompt; the result is
 * checked here — a date that isn't real or is over a year away is dropped,
 * leaving the day the user picked on the calendar.
 */
class CalendarEventDrafter extends Drafter
{
    public function kind(): string
    {
        return 'calendar_event';
    }

    public function authorize(User $user): bool
    {
        return $user->can('manage-calendar');
    }

    protected function prompt(): string
    {
        return <<<TXT
            You write school calendar entries. From the notes, write a short title (under 80 characters) and a description of 1-3 sentences for parents, students and staff.
            Today is {$this->today()}. If the notes give a day ("next Thursday", "on the 5th"), give its date as YYYY-MM-DD; otherwise null.
            {$this->sameLanguage()} Don't invent times, places or details that aren't in the notes.
            Reply with JSON only, no other text: {"title":"...","description":"...","date":null}
            TXT;
    }

    protected function shape(array $data): array
    {
        return [
            'title' => $this->text($data, 'title', 255, required: true),
            'description' => $this->text($data, 'description', 2000) ?? '',
            'date' => $this->date($data['date'] ?? null),
        ];
    }

    /** YYYY-MM-DD within a year of today, else null. */
    private function date(mixed $value): ?string
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        $date = CarbonImmutable::createFromFormat('!Y-m-d', $value);

        return $date && $date->format('Y-m-d') === $value && abs($date->diffInDays(now()->startOfDay())) <= 366 ? $value : null;
    }
}
