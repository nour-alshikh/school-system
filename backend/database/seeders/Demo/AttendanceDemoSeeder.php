<?php

namespace Database\Seeders\Demo;

use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\ClassroomSubjectTeacher;
use App\Models\Setting;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Attendance for every student over the school's last 20 school days (its
 * school_days setting), today included. A few students have a noticeably
 * worse record, so the reports have something to show.
 */
class AttendanceDemoSeeder
{
    private const DAYS = 20;

    /** Out of 100: present, absent, late, excused. */
    private const USUAL = ['present' => 88, 'absent' => 6, 'late' => 4, 'excused' => 2];

    private const STRUGGLING = ['present' => 60, 'absent' => 25, 'late' => 12, 'excused' => 3];

    public function run(User $admin): void
    {
        $dates = $this->schoolDays(Setting::schoolDays() ?? [0, 1, 2, 3, 4, 5, 6]);

        $students = Student::where('status', StudentStatus::Active)->whereNotNull('classroom_id')->orderBy('id')->get();
        $struggling = $students->shuffle(fake()->randomNumber())->take(3)->pluck('id')->all();

        // Recorded by one of the classroom's teachers, as in real use.
        $recorders = ClassroomSubjectTeacher::with('teacher')->orderBy('id')->get()
            ->groupBy('classroom_id')
            ->map(fn ($rows) => $rows->first()->teacher?->user_id);

        foreach ($students as $student) {
            $weights = in_array($student->id, $struggling, true) ? self::STRUGGLING : self::USUAL;

            foreach ($dates as $date) {
                Attendance::create([
                    'student_id' => $student->id,
                    'classroom_id' => $student->classroom_id,
                    'academic_year_id' => $student->academic_year_id,
                    'date' => $date,
                    'status' => $this->pick($weights),
                    'recorded_by' => $recorders->get($student->classroom_id) ?? $admin->id,
                ]);
            }
        }
    }

    /**
     * @param  list<int>  $weekdays  0 = Sunday … 6 = Saturday
     * @return list<string>
     */
    private function schoolDays(array $weekdays): array
    {
        $dates = [];

        for ($day = Carbon::today(); count($dates) < self::DAYS; $day = $day->subDay()) {
            if (in_array($day->dayOfWeek, $weekdays, true)) {
                $dates[] = $day->toDateString();
            }
        }

        return $dates;
    }

    /** @param  array<string, int>  $weights */
    private function pick(array $weights): string
    {
        $roll = fake()->numberBetween(1, array_sum($weights));

        foreach ($weights as $status => $weight) {
            if (($roll -= $weight) <= 0) {
                return $status;
            }
        }

        return 'present';
    }
}
