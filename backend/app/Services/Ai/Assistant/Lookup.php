<?php

namespace App\Services\Ai\Assistant;

use App\Models\Classroom;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/** Small helpers the tools share: names, fuzzy classroom matching, dates. */
final class Lookup
{
    /** A translatable name in both languages, "Omar / عمر" when they differ. */
    public static function name($model, string $attribute = 'name'): string
    {
        if (! $model) {
            return '';
        }

        $en = $model->getTranslation($attribute, 'en', false);
        $ar = $model->getTranslation($attribute, 'ar', false);

        return $en && $ar && $en !== $ar ? "{$en} / {$ar}" : ($en ?: $ar);
    }

    public static function classroomLabel(?Classroom $classroom): ?string
    {
        if (! $classroom) {
            return null;
        }

        $grade = $classroom->grade?->getTranslation('name', 'en', false);

        return $grade && ! str_contains($classroom->name, $grade) ? "{$classroom->name} ({$grade})" : $classroom->name;
    }

    /** @return array{name: string, classroom: string|null} */
    public static function student(Student $student): array
    {
        return ['name' => self::name($student), 'classroom' => self::classroomLabel($student->classroom)];
    }

    /**
     * Classrooms in $scope matching what the user typed ("4-A", "4a",
     * "Grade 4 A"): letters and digits only, an exact name first, else
     * either containing the other, by name or grade + name.
     */
    public static function matchClassrooms(Builder $scope, string $typed): Collection
    {
        $needle = self::squash($typed);
        if ($needle === '') {
            return collect();
        }

        $all = $scope->get();
        $exact = $all->filter(fn (Classroom $c) => self::squash($c->name) === $needle);
        if ($exact->isNotEmpty()) {
            return $exact->values();
        }

        return $all->filter(function (Classroom $c) use ($needle) {
            $grade = $c->grade;
            $candidates = [
                $c->name,
                ($grade?->getTranslation('name', 'en', false) ?? '').$c->name,
                ($grade?->getTranslation('name', 'ar', false) ?? '').$c->name,
            ];

            foreach ($candidates as $hay) {
                $hay = self::squash($hay);
                if ($hay !== '' && (str_contains($hay, $needle) || str_contains($needle, $hay))) {
                    return true;
                }
            }

            return false;
        })->values();
    }

    /** Lowercase letters and digits only. */
    public static function squash(string $text): string
    {
        return preg_replace('/[^\p{L}\p{N}]/u', '', mb_strtolower($text));
    }

    /**
     * [from, to] as dates: $defaultDays ending today when not given, swapped
     * when backwards, at most $maxDays long.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function range(?string $from, ?string $to, int $defaultDays, int $maxDays): array
    {
        $end = $to ? Carbon::parse($to)->startOfDay() : today();
        $start = $from ? Carbon::parse($from)->startOfDay() : $end->copy()->subDays($defaultDays - 1);

        if ($start->gt($end)) {
            [$start, $end] = [$end, $start];
        }
        if ($start->diffInDays($end) >= $maxDays) {
            $start = $end->copy()->subDays($maxDays - 1);
        }

        return [$start, $end];
    }

    public static function money(float|int|string $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }

    public static function percent(int|float $part, int|float $total): ?float
    {
        return $total > 0 ? round($part / $total * 100, 1) : null;
    }
}
