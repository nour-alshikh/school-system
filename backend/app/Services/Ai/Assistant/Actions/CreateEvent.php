<?php

namespace App\Services\Ai\Assistant\Actions;

use App\Services\Ai\Assistant\Action;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/** "Add sports day next Thursday" → a calendar event to confirm (POST /api/calendar-events). */
class CreateEvent extends Action
{
    public function name(): string
    {
        return 'create_event';
    }

    public function describe(): string
    {
        return 'create_event(title: string, date: "YYYY-MM-DD", description?: string) — a school calendar event.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-calendar');
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date_format:Y-m-d'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function prepare(ToolContext $context, array $fields): array
    {
        $date = Carbon::parse($fields['date']);
        $warnings = [];

        if ($date->lt(today())) {
            $warnings[] = 'past_date';
        }
        if ($date->gt(today()->addYears(2))) {
            return ['error' => 'That date is more than two years away.'];
        }

        return [
            'fields' => [
                'title' => Str::limit(trim($fields['title']), 255, ''),
                'date' => $date->toDateString(),
                'description' => filled($fields['description'] ?? null) ? trim($fields['description']) : null,
            ],
            'warnings' => $warnings,
        ];
    }
}
