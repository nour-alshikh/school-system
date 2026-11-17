<?php

namespace App\Services\Ai\Assistant\Actions;

use App\Models\Classroom;
use App\Models\ZoomConnection;
use App\Services\Ai\Assistant\Action;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Support\Carbon;

/**
 * "Revision for 9-B on Sunday at 10 for 45 minutes" → an online lesson to
 * confirm (POST /api/meetings). Classrooms are matched only among the ones
 * the user may schedule for: all with manage-meetings, a teacher's own.
 */
class ScheduleMeeting extends Action
{
    public function name(): string
    {
        return 'schedule_meeting';
    }

    public function describe(): string
    {
        return 'schedule_meeting(title: string, classrooms: string[], start: "YYYY-MM-DD HH:MM", duration_minutes: number, description?: string) — a Zoom online lesson for those classrooms.';
    }

    public function allows(ToolContext $context): bool
    {
        return ($context->can('manage-meetings') || $context->teacher() !== null) && $context->hasFeature('meetings');
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'classrooms' => ['required', 'array', 'min:1', 'max:20'],
            'classrooms.*' => ['string', 'max:50'],
            'start' => ['required', 'date_format:Y-m-d H:i'],
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function prepare(ToolContext $context, array $fields): array
    {
        $start = Carbon::createFromFormat('Y-m-d H:i', $fields['start']);
        if ($start->isPast()) {
            return ['error' => 'The start time has already passed.'];
        }

        // Same classrooms as MeetingController::classrooms().
        $scope = fn () => $context->can('manage-meetings')
            ? Classroom::with('grade')->orderBy('id')
            : Classroom::with('grade')->orderBy('id')->whereIn('id', $context->teacher()->classroomSubjects()->pluck('classroom_id'));

        $classrooms = collect();
        $warnings = [];
        foreach (array_unique($fields['classrooms']) as $typed) {
            $matches = Lookup::matchClassrooms($scope(), $typed);
            if ($matches->count() === 1) {
                $classrooms->push($matches->first());
            } else {
                $warnings[] = $matches->isEmpty() ? "classroom_not_found:{$typed}" : "classroom_ambiguous:{$typed}";
            }
        }

        if ($classrooms->isEmpty()) {
            return ['error' => 'None of those classrooms are ones you can schedule for.'];
        }

        if (! ZoomConnection::exists()) {
            $warnings[] = 'zoom_not_connected';
        }

        $classrooms = $classrooms->unique('id')->values();

        return [
            'fields' => [
                'title' => trim($fields['title']),
                'description' => filled($fields['description'] ?? null) ? trim($fields['description']) : null,
                'classroom_ids' => $classrooms->pluck('id')->all(),
                'classrooms' => $classrooms->map(fn (Classroom $c) => Lookup::classroomLabel($c))->all(),
                // As a datetime-local input wants it, in the school's time.
                'start_time' => $start->format('Y-m-d\TH:i'),
                'duration_minutes' => (int) $fields['duration_minutes'],
            ],
            'warnings' => $warnings,
        ];
    }
}
