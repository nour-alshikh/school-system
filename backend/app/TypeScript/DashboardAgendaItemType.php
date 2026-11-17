<?php

namespace App\TypeScript;

use App\Models\CalendarEvent;
use App\Models\Exam;
use App\Models\Meeting;
use Illuminate\Support\Collection;
use Spatie\TypeScriptTransformer\Attributes\LiteralTypeScriptType;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One row of a role dashboard's "Coming up" list: an online lesson, an exam
 * that closes, or a school calendar event. There's no timetable in the app,
 * so this is what a day's schedule is built from (docs/design-refresh-plan.md,
 * step 4).
 */
#[TypeScript]
final class DashboardAgendaItemType
{
    public function __construct(
        #[LiteralTypeScriptType("'meeting' | 'exam' | 'event'")]
        public readonly string $kind,
        public readonly int $id,
        public readonly string $title,
        /** ISO date-time; a plain Y-m-d date when all_day. For an exam, when it closes. */
        public readonly string $starts_at,
        public readonly bool $all_day,
        public readonly ?int $duration_minutes,
        public readonly ?string $subject_name_en,
        public readonly ?string $subject_name_ar,
    ) {}

    public static function forMeeting(Meeting $meeting): self
    {
        return new self('meeting', $meeting->id, $meeting->title, $meeting->start_time->toJSON(), false, $meeting->duration_minutes, null, null);
    }

    /** Needs `subject` loaded. */
    public static function forExam(Exam $exam): self
    {
        return new self(
            'exam', $exam->id, $exam->title, $exam->closes_at->toJSON(), false, null,
            $exam->subject->getTranslation('name', 'en'), $exam->subject->getTranslation('name', 'ar'),
        );
    }

    public static function forEvent(CalendarEvent $event): self
    {
        return new self('event', $event->id, $event->title, $event->date->toDateString(), true, null, null, null);
    }

    /** School calendar events from today through $days ahead, in the current school. */
    public static function events(int $days): Collection
    {
        return CalendarEvent::whereBetween('date', [today()->toDateString(), today()->addDays($days)->toDateString()])
            ->orderBy('date')
            ->get()
            ->map(fn (CalendarEvent $event) => self::forEvent($event));
    }

    /**
     * Soonest first (an all-day event sorts at the start of its day), at most $limit.
     *
     * @param  Collection<int, self>  $items
     * @return list<self>
     */
    public static function sorted(Collection $items, int $limit): array
    {
        return $items->sortBy(fn (self $item) => $item->all_day ? $item->starts_at.'T00:00:00' : $item->starts_at)
            ->take($limit)
            ->values()
            ->all();
    }
}
