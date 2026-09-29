<?php

namespace Database\Seeders\Demo;

use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\User;
use App\Services\GraduationService;
use App\Services\PromotionService;

/**
 * Something for the promotion and graduation history pages (and their
 * rollback buttons): a small cohort promoted from last year, and one
 * graduate. Through the real services, not raw inserts. Uses "B"
 * classrooms, which the base seed leaves empty, so no other student moves.
 */
class HistoryDemoSeeder
{
    public function __construct(private readonly DemoPeople $people) {}

    public function run(User $admin): void
    {
        $lastYear = AcademicYear::where('year', 2024)->firstOrFail();
        $thisYear = AcademicYear::where('is_current', true)->firstOrFail();

        $from = Classroom::with('grade')->where('name', 'Grade 5 - B')->firstOrFail();
        $to = Classroom::with('grade')->where('name', 'Grade 6 - B')->firstOrFail();

        foreach (range(1, 3) as $_) {
            $this->people->student($from, $lastYear, 'demo.school');
        }

        app(PromotionService::class)->promote([
            'from' => ['classroom_id' => $from->id],
            'to' => [
                'stage_id' => $to->grade->stage_id,
                'grade_id' => $to->grade_id,
                'classroom_id' => $to->id,
                'academic_year_id' => $thisYear->id,
            ],
        ], $admin);

        $finalYear = Classroom::where('name', 'Grade 12 - B')->firstOrFail();
        $this->people->student($finalYear, $thisYear, 'demo.school');

        app(GraduationService::class)->graduate(['classroom_id' => $finalYear->id], $admin);
    }
}
