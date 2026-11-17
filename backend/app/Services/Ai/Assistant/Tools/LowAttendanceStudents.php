<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Enums\AttendanceStatus;
use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\Student;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;

/**
 * "Which students are below 75%?" — active students whose attendance rate
 * (present + late over all records) is under a threshold, in the classrooms
 * this user may read. Like the admin dashboard's low-attendance count:
 * only students with at least 5 records in the window.
 */
class LowAttendanceStudents extends Tool
{
    public const MIN_RECORDS = 5;

    public function name(): string
    {
        return 'low_attendance_students';
    }

    public function describe(): string
    {
        return 'low_attendance_students(below_percent?: number = 75, days?: number = 30, classroom?: string) — active students under that attendance rate over the last N days, lowest first.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-attendance') || $context->teacher() !== null;
    }

    public function rules(): array
    {
        return [
            'below_percent' => ['nullable', 'numeric', 'min:1', 'max:100'],
            'days' => ['nullable', 'integer', 'min:7', 'max:180'],
            'classroom' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function run(ToolContext $context, array $args): array
    {
        $below = (float) ($args['below_percent'] ?? 75);
        $days = (int) ($args['days'] ?? 30);

        $classrooms = filled($args['classroom'] ?? null)
            ? Lookup::matchClassrooms($context->attendanceClassrooms(), $args['classroom'])
            : $context->attendanceClassrooms()->get();

        if ($classrooms->isEmpty()) {
            return ['error' => 'No classroom you can see matches that.'];
        }

        $attended = implode("','", [AttendanceStatus::Present->value, AttendanceStatus::Late->value]);
        $since = today()->subDays($days - 1)->toDateString();

        $rows = Attendance::whereIn('classroom_id', $classrooms->pluck('id'))
            ->where('date', '>=', $since)
            ->whereHas('student', fn ($q) => $q->where('status', StudentStatus::Active))
            ->selectRaw("student_id, count(*) as total, sum(case when status in ('{$attended}') then 1 else 0 end) as attended")
            ->groupBy('student_id')
            ->toBase()
            ->get()
            ->filter(fn ($row) => (int) $row->total >= self::MIN_RECORDS && ((int) $row->attended / (int) $row->total * 100) < $below)
            ->sortBy(fn ($row) => (int) $row->attended / (int) $row->total)
            ->values();

        $students = Student::with('classroom.grade')->whereIn('id', $rows->pluck('student_id')->take(25))->get()->keyBy('id');

        return [
            'since' => $since,
            'below_percent' => $below,
            'source' => 'attendance records (present and late count as attended; students with fewer than '.self::MIN_RECORDS.' records are left out)',
            'count' => $rows->count(),
            'students' => $rows->take(25)
                ->map(fn ($row) => ($student = $students->get($row->student_id)) ? [
                    ...Lookup::student($student),
                    'attendance_rate_percent' => Lookup::percent((int) $row->attended, (int) $row->total),
                    'records' => (int) $row->total,
                ] : null)
                ->filter()->values()->all(),
            'classrooms_checked' => $classrooms->count(),
            'links' => [['href' => '/attendance/history', 'label' => 'Attendance history']],
        ];
    }
}
