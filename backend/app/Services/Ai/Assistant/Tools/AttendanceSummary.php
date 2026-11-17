<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Enums\AttendanceStatus;
use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;

/**
 * "Who was absent today in 4-A?" — attendance counts per classroom for a
 * date range, and who wasn't present when it's about chosen classrooms.
 * Same classrooms as the attendance pages: all of them with
 * manage-attendance, a teacher's own otherwise.
 */
class AttendanceSummary extends Tool
{
    public const MAX_DAYS = 92;

    public function name(): string
    {
        return 'attendance_summary';
    }

    public function describe(): string
    {
        return 'attendance_summary(from?: "YYYY-MM-DD", to?: "YYYY-MM-DD", classroom?: string) — present/absent/late/excused counts per classroom (default: today), classrooms not marked yet on a single day, and the students not present when a classroom is given.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-attendance') || $context->teacher() !== null;
    }

    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'classroom' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function run(ToolContext $context, array $args): array
    {
        [$from, $to] = Lookup::range($args['from'] ?? null, $args['to'] ?? ($args['from'] ?? null), 1, self::MAX_DAYS);

        $scope = $context->attendanceClassrooms();
        $chosen = filled($args['classroom'] ?? null);

        if ($chosen) {
            $classrooms = Lookup::matchClassrooms($scope, $args['classroom'])->take(10);
            if ($classrooms->isEmpty()) {
                return [
                    'error' => "No classroom you can see matches \"{$args['classroom']}\".",
                    'your_classrooms' => $context->attendanceClassrooms()->limit(40)->get()->map(fn (Classroom $c) => Lookup::classroomLabel($c))->all(),
                ];
            }
        } else {
            $classrooms = $scope->get();
        }

        $ids = $classrooms->pluck('id');
        $counts = Attendance::whereIn('classroom_id', $ids)
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('classroom_id, status, count(*) as n')
            ->groupBy('classroom_id', 'status')
            ->toBase()
            ->get()
            ->groupBy('classroom_id');

        $rows = $classrooms
            ->map(function (Classroom $c) use ($counts) {
                $byStatus = collect($counts->get($c->id, []))->pluck('n', 'status')->map(fn ($n) => (int) $n);
                $total = (int) $byStatus->sum();
                $attended = ($byStatus['present'] ?? 0) + ($byStatus['late'] ?? 0);

                return [
                    'classroom' => Lookup::classroomLabel($c),
                    'records' => $total,
                    'present' => $byStatus['present'] ?? 0,
                    'absent' => $byStatus['absent'] ?? 0,
                    'late' => $byStatus['late'] ?? 0,
                    'excused' => $byStatus['excused'] ?? 0,
                    'attendance_rate_percent' => Lookup::percent($attended, $total),
                ];
            })
            ->values();

        $result = [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'source' => 'attendance records',
            'classrooms' => $rows->where('records', '>', 0)->take(40)->values()->all(),
            'classrooms_without_records' => $rows->where('records', 0)->pluck('classroom')->take(40)->values()->all(),
        ];

        // A single day across classrooms: which ones still need marking
        // (with active students), as on the admin dashboard.
        if ($from->equalTo($to)) {
            $result['classrooms_without_records'] = $classrooms
                ->filter(fn (Classroom $c) => ! $counts->has($c->id) && $c->students()->where('status', StudentStatus::Active)->exists())
                ->map(fn (Classroom $c) => Lookup::classroomLabel($c))
                ->take(40)->values()->all();
        }

        if ($chosen) {
            $result['not_present'] = Attendance::with('student')
                ->whereIn('classroom_id', $ids)
                ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                ->whereIn('status', [AttendanceStatus::Absent, AttendanceStatus::Late, AttendanceStatus::Excused])
                ->orderBy('date')
                ->limit(60)
                ->get()
                ->map(fn (Attendance $a) => [
                    'student' => Lookup::name($a->student),
                    'date' => $a->date->toDateString(),
                    'status' => $a->status->value,
                ])
                ->all();
        }

        $result['links'] = [['href' => '/attendance/history', 'label' => 'Attendance history']];

        return $result;
    }
}
