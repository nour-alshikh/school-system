<?php

namespace App\Services\Ai;

use App\Enums\AttendanceStatus;
use App\Enums\ExamStatus;
use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Exam;
use App\Models\FeePayment;
use App\Models\School;
use App\Models\Setting;
use App\Models\Student;
use App\Services\Ai\Assistant\Lookup;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * The admin dashboard's weekly summary (docs/ai-assistant-plan.md, phase 7):
 * the last 7 days in numbers — attendance, classes left unmarked, payments,
 * enrollments, exams coming — which the card always shows, and on request a
 * few sentences the AI writes from those numbers only. The written summary
 * is kept until the end of the day per school and language, so admins
 * opening the dashboard don't each pay for one.
 */
class WeeklySummary
{
    public const DAYS = 7;

    public function __construct(private readonly AiClient $client) {}

    /** The facts, computed fresh (current school's scope). */
    public function facts(School $school): array
    {
        $features = $school->effectivePlan()->features ?? [];
        $from = today()->subDays(self::DAYS - 1);

        $facts = [
            'from' => $from->toDateString(),
            'to' => today()->toDateString(),
            'attendance' => $this->attendance($from),
            'unmarked_days' => $this->unmarkedDays($from),
            'new_students' => Student::where('created_at', '>=', $from)->count(),
        ];

        if (in_array('fees', $features, true)) {
            $payments = FeePayment::where('paid_at', '>=', $from->toDateString())->toBase()->get(['amount']);
            $facts['payments'] = [
                'count' => $payments->count(),
                'total' => Lookup::money($payments->sum(fn ($p) => (float) $p->amount)),
                'currency' => Setting::currency(),
            ];
        }

        if (in_array('exams', $features, true)) {
            $facts['exams_next_7_days'] = Exam::where('status', ExamStatus::Published)
                ->whereBetween('opens_at', [now(), now()->addDays(self::DAYS)])
                ->count();
        }

        return $facts;
    }

    /** Today's written summary in $locale, if one was written. */
    public function cached(School $school, string $locale): ?array
    {
        return Cache::get($this->cacheKey($school, $locale));
    }

    /**
     * Writes the summary from the facts and keeps it for the rest of the day.
     *
     * @throws AiCapReached
     * @throws RuntimeException
     */
    public function write(School $school, string $locale, array $facts): array
    {
        $language = $locale === 'ar' ? 'Modern Standard Arabic' : 'English';

        $reply = $this->client->json(
            'weekly_summary',
            <<<TXT
                You write the "this week" summary on a school admin's dashboard. You get the last 7 days of the school's numbers as JSON.
                Write 2-4 short sentences in {$language}: how attendance went (compare with the week before when both rates exist), anything that needs the admin's attention (classes left unmarked, naming the day), then payments, new students and exams coming up if there are any. Use only the numbers given, rounded sensibly; never invent or estimate. Skip anything that is zero or missing rather than saying so, unless nothing happened at all.
                Plain text, no headings, lists or emoji.
                Reply with JSON only, no other text: {"summary":"..."}
                TXT,
            "<numbers>\n".json_encode($facts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)."\n</numbers>",
            function (array $data) {
                $text = mb_substr(trim(is_string($data['summary'] ?? null) ? $data['summary'] : ''), 0, 1200);
                if ($text === '') {
                    throw new RuntimeException('Weekly summary reply has no summary');
                }

                return ['text' => $text];
            },
            0.3,
            600,
        );

        $summary = ['text' => $reply['text'], 'generated_at' => now()->toJSON()];
        Cache::put($this->cacheKey($school, $locale), $summary, now()->endOfDay());

        return $summary;
    }

    private function cacheKey(School $school, string $locale): string
    {
        return "weekly-summary:{$school->id}:{$locale}:".today()->toDateString();
    }

    /** This week's rate and last week's, present + late over all records. */
    private function attendance(Carbon $from): array
    {
        $counts = fn (Carbon $start, Carbon $end) => Attendance::whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('status, count(*) as n')
            ->groupBy('status')
            ->toBase()
            ->pluck('n', 'status')
            ->map(fn ($n) => (int) $n);

        $week = $counts($from, today());
        $previous = $counts($from->copy()->subDays(self::DAYS), $from->copy()->subDay());
        $attended = fn (Collection $c) => $c->get(AttendanceStatus::Present->value, 0) + $c->get(AttendanceStatus::Late->value, 0);

        return [
            'records' => $week->sum(),
            'present' => $week->get(AttendanceStatus::Present->value, 0),
            'late' => $week->get(AttendanceStatus::Late->value, 0),
            'absent' => $week->get(AttendanceStatus::Absent->value, 0),
            'excused' => $week->get(AttendanceStatus::Excused->value, 0),
            'rate_percent' => Lookup::percent($attended($week), $week->sum()),
            'previous_week_rate_percent' => Lookup::percent($attended($previous), $previous->sum()),
        ];
    }

    /**
     * School days in the window (today included, it may still be marked
     * later) with classrooms that have active students but no attendance:
     * how many, and up to five names.
     */
    private function unmarkedDays(Carbon $from): array
    {
        $schoolDays = Setting::schoolDays();
        $classrooms = Classroom::with('grade')
            ->whereHas('students', fn ($q) => $q->where('status', StudentStatus::Active))
            ->orderBy('grade_id')
            ->orderBy('name')
            ->get();

        if ($classrooms->isEmpty()) {
            return [];
        }

        $marked = Attendance::where('date', '>=', $from->toDateString())
            ->selectRaw('date, classroom_id')
            ->distinct()
            ->toBase()
            ->get()
            ->groupBy(fn ($row) => substr((string) $row->date, 0, 10))
            ->map(fn (Collection $rows) => $rows->pluck('classroom_id')->map(fn ($id) => (int) $id)->all());

        return collect(range(0, self::DAYS - 1))
            ->map(fn (int $i) => $from->copy()->addDays($i))
            ->filter(fn (Carbon $day) => $schoolDays === null || in_array($day->dayOfWeek, $schoolDays, true))
            ->map(function (Carbon $day) use ($classrooms, $marked) {
                $done = $marked->get($day->toDateString(), []);
                $missing = $classrooms->reject(fn (Classroom $c) => in_array($c->id, $done, true));

                return [
                    'date' => $day->toDateString(),
                    'weekday' => $day->englishDayOfWeek,
                    'is_today' => $day->isToday(),
                    'unmarked_count' => $missing->count(),
                    'classrooms' => $missing->take(5)->map(fn (Classroom $c) => Lookup::classroomLabel($c))->values()->all(),
                ];
            })
            ->filter(fn (array $day) => $day['unmarked_count'] > 0)
            ->values()
            ->all();
    }
}
