<?php

namespace App\Services\Ai\Assistant\Actions;

use App\Enums\AttendanceStatus;
use App\Enums\StudentStatus;
use App\Models\Student;
use App\Services\Ai\Assistant\Action;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * "Everyone present in 4-A except Salma, Omar late" → opens the attendance
 * page for that classroom and day with those marks filled in, to review and
 * save. The classroom is matched among the ones the user may mark; names
 * among its active students, on the server — the roster never goes to the
 * AI provider.
 */
class MarkAttendance extends Action
{
    public function name(): string
    {
        return 'mark_attendance';
    }

    public function describe(): string
    {
        return 'mark_attendance(classroom: string, date?: "YYYY-MM-DD" = today, default_status?: "present"|"absent" = "present", exceptions?: [{"student": name, "status": "present"|"absent"|"late"|"excused"}]) — opens the attendance page filled in this way, for the user to check and save.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-attendance') || $context->teacher() !== null;
    }

    public function rules(): array
    {
        $statuses = array_column(AttendanceStatus::cases(), 'value');

        return [
            'classroom' => ['required', 'string', 'max:50'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'default_status' => ['nullable', Rule::in(['present', 'absent'])],
            'exceptions' => ['nullable', 'array', 'max:60'],
            'exceptions.*.student' => ['required', 'string', 'max:100'],
            'exceptions.*.status' => ['required', Rule::in($statuses)],
        ];
    }

    public function prepare(ToolContext $context, array $fields): array
    {
        $date = isset($fields['date']) ? Carbon::parse($fields['date']) : today();
        if ($date->gt(today())) {
            return ['error' => 'Attendance can\'t be marked for a future day.'];
        }

        $matches = Lookup::matchClassrooms($context->attendanceClassrooms(), $fields['classroom']);
        if ($matches->count() !== 1) {
            return ['error' => $matches->isEmpty()
                ? "No classroom you can mark matches \"{$fields['classroom']}\"."
                : "\"{$fields['classroom']}\" matches more than one classroom: ".$matches->map(fn ($c) => Lookup::classroomLabel($c))->implode(', ').'.'];
        }
        $classroom = $matches->first();

        $roster = Student::where('classroom_id', $classroom->id)->where('status', StudentStatus::Active)->orderBy('id')->get();

        $exceptions = [];
        $warnings = [];
        foreach ($fields['exceptions'] ?? [] as $row) {
            $found = self::findStudent($roster, $row['student']);
            if ($found === null) {
                $warnings[] = "student_not_found:{$row['student']}";
            } elseif ($found === false) {
                $warnings[] = "student_ambiguous:{$row['student']}";
            } else {
                $exceptions[$found->id] = ['student_id' => $found->id, 'name' => Lookup::name($found), 'status' => $row['status']];
            }
        }

        return [
            'fields' => [
                'classroom_id' => $classroom->id,
                'classroom' => Lookup::classroomLabel($classroom),
                'date' => $date->toDateString(),
                'default_status' => $fields['default_status'] ?? 'present',
                'students' => $roster->count(),
                'exceptions' => array_values($exceptions),
            ],
            'warnings' => $warnings,
        ];
    }

    /**
     * The one student named $typed: the same letters as a full name, else
     * every typed word starting a word of the name ("Salma", "Salma A").
     * Null when none, false when several.
     */
    private static function findStudent($roster, string $typed): Student|false|null
    {
        $needle = Lookup::squash($typed);
        if ($needle === '') {
            return null;
        }

        $names = fn (Student $s) => array_filter([$s->getTranslation('name', 'en', false), $s->getTranslation('name', 'ar', false)]);

        $exact = $roster->filter(fn (Student $s) => collect($names($s))->contains(fn ($n) => Lookup::squash($n) === $needle));
        $partial = $exact->isNotEmpty() ? $exact : $roster->filter(function (Student $s) use ($names, $typed) {
            // Every typed word starts a word of the name: "Salma" or "Salma A".
            foreach ($names($s) as $name) {
                $nameWords = preg_split('/\s+/u', mb_strtolower($name));
                $typedWords = preg_split('/\s+/u', mb_strtolower(trim($typed)));
                if (collect($typedWords)->every(fn ($w) => collect($nameWords)->contains(fn ($nw) => str_starts_with($nw, $w)))) {
                    return true;
                }
            }

            return false;
        });

        return match ($partial->count()) {
            0 => null,
            1 => $partial->first(),
            default => false,
        };
    }
}
