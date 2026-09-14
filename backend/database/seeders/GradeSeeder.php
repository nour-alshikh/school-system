<?php

namespace Database\Seeders;

use App\Models\Grade;
use App\Models\Stage;
use Illuminate\Database\Seeder;

class GradeSeeder extends Seeder
{
    public function run(): void
    {
        $gradesByStage = [
            'Primary' => [
                ['en' => 'Grade 1', 'ar' => 'الصف الأول'],
                ['en' => 'Grade 2', 'ar' => 'الصف الثاني'],
                ['en' => 'Grade 3', 'ar' => 'الصف الثالث'],
                ['en' => 'Grade 4', 'ar' => 'الصف الرابع'],
                ['en' => 'Grade 5', 'ar' => 'الصف الخامس'],
                ['en' => 'Grade 6', 'ar' => 'الصف السادس'],
            ],
            'Preparatory' => [
                ['en' => 'Grade 7', 'ar' => 'الصف السابع'],
                ['en' => 'Grade 8', 'ar' => 'الصف الثامن'],
                ['en' => 'Grade 9', 'ar' => 'الصف التاسع'],
            ],
            'Secondary' => [
                ['en' => 'Grade 10', 'ar' => 'الصف العاشر'],
                ['en' => 'Grade 11', 'ar' => 'الصف الحادي عشر'],
                ['en' => 'Grade 12', 'ar' => 'الصف الثاني عشر'],
            ],
        ];

        foreach ($gradesByStage as $stageEnName => $grades) {
            $stage = Stage::all()
                ->first(fn (Stage $stage) => $stage->getTranslation('name', 'en') === $stageEnName);

            if (! $stage) {
                continue;
            }

            // name is a JSON column (HasTranslations), so there's no unique
            // column to key firstOrCreate off of — check the English name in
            // PHP instead, to keep this seeder safe to run more than once.
            $existingEnNames = $stage->grades()
                ->get()
                ->map(fn (Grade $grade) => $grade->getTranslation('name', 'en'))
                ->all();

            foreach ($grades as $name) {
                if (in_array($name['en'], $existingEnNames, true)) {
                    continue;
                }

                Grade::create(['stage_id' => $stage->id, 'name' => $name]);
            }
        }
    }
}
