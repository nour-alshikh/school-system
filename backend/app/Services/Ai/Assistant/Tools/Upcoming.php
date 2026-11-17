<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Enums\ExamStatus;
use App\Models\CalendarEvent;
use App\Models\Exam;
use App\Models\Meeting;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\StudentSummary;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Support\Collection;

/**
 * "What's on next week?" — school calendar events for everyone, plus the
 * exams and online lessons this user would see on their own pages: all of
 * them for staff who manage them, a teacher's own, a student's or a
 * parent's children's.
 */
class Upcoming extends Tool
{
    public function name(): string
    {
        return 'upcoming';
    }

    public function describe(): string
    {
        return 'upcoming(days?: number = 14) — calendar events, exams (opening or closing) and online lessons from today through the next N days, as this person would see them.';
    }

    public function allows(ToolContext $context): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['days' => ['nullable', 'integer', 'min:1', 'max:60']];
    }

    public function run(ToolContext $context, array $args): array
    {
        $days = (int) ($args['days'] ?? 14);
        $start = now()->startOfDay();
        $end = today()->addDays($days)->endOfDay();

        $items = CalendarEvent::whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->orderBy('date')
            ->get()
            ->map(fn (CalendarEvent $e) => ['kind' => 'event', 'when' => $e->date->toDateString(), 'title' => $e->title]);

        if ($context->hasFeature('exams')) {
            $items = $items->concat($this->exams($context, $start, $end));
        }
        if ($context->hasFeature('meetings')) {
            $items = $items->concat($this->meetings($context, $start, $end));
        }

        return [
            'from' => $start->toDateString(),
            'to' => $end->toDateString(),
            'source' => 'the school calendar, exams and online lessons',
            'items' => $items->sortBy('when')->take(30)->values()->all(),
            'links' => [['href' => '/dashboard', 'label' => 'Dashboard']],
        ];
    }

    private function exams(ToolContext $context, $start, $end): Collection
    {
        $inRange = fn ($q) => $q->where(fn ($q) => $q->whereBetween('opens_at', [$start, $end])->orWhereBetween('closes_at', [$start, $end]));

        if ($context->can('manage-exams')) {
            $exams = Exam::with('subject')->where('status', ExamStatus::Published)->where($inRange)->get();
        } elseif ($context->teacher()) {
            $exams = Exam::with('subject')->where('created_by', $context->user->id)->where('status', ExamStatus::Published)->where($inRange)->get();
        } else {
            $students = collect([$context->student()])->filter()->concat($context->children());
            $exams = $students->flatMap(fn ($student) => StudentSummary::exams($student)->where($inRange)->get())->unique('id');
        }

        return $exams->map(fn (Exam $exam) => [
            'kind' => 'exam',
            'when' => ($exam->opens_at && $exam->opens_at->gte($start) ? $exam->opens_at : $exam->closes_at)?->toDateTimeString(),
            'title' => $exam->title,
            'subject' => Lookup::name($exam->subject),
            'opens_at' => $exam->opens_at?->toDateTimeString(),
            'closes_at' => $exam->closes_at?->toDateTimeString(),
        ])->values();
    }

    private function meetings(ToolContext $context, $start, $end): Collection
    {
        if ($context->can('manage-meetings')) {
            $query = Meeting::query();
        } elseif ($context->teacher()) {
            $query = Meeting::where('created_by', $context->user->id);
        } elseif ($student = $context->student()) {
            $query = StudentSummary::meetings($student);
        } else {
            return collect();
        }

        return $query->whereBetween('start_time', [$start, $end])->orderBy('start_time')->limit(20)->get()
            ->map(fn (Meeting $m) => ['kind' => 'online_lesson', 'when' => $m->start_time->toDateTimeString(), 'title' => $m->title, 'minutes' => $m->duration_minutes]);
    }
}
