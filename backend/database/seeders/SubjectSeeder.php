<?php

namespace Database\Seeders;

use App\Models\Stage;
use App\Models\Subject;
use Illuminate\Database\Seeder;

class SubjectSeeder extends Seeder
{
    public function run(): void
    {
        // Each subject is scoped to every stage it's taught across (Subject::stages()
        // is many-to-many), not duplicated per stage — e.g. one "Mathematics" row
        // spans all three stages instead of three separate "Mathematics" subjects.
        $subjects = [
            ['name' => ['en' => 'Arabic', 'ar' => 'اللغة العربية'], 'stages' => ['Primary', 'Preparatory', 'Secondary']],
            ['name' => ['en' => 'English', 'ar' => 'اللغة الإنجليزية'], 'stages' => ['Primary', 'Preparatory', 'Secondary']],
            ['name' => ['en' => 'Mathematics', 'ar' => 'الرياضيات'], 'stages' => ['Primary', 'Preparatory', 'Secondary']],
            ['name' => ['en' => 'Science', 'ar' => 'العلوم'], 'stages' => ['Primary', 'Preparatory']],
            ['name' => ['en' => 'Social Studies', 'ar' => 'الدراسات الاجتماعية'], 'stages' => ['Primary', 'Preparatory']],
            ['name' => ['en' => 'French', 'ar' => 'اللغة الفرنسية'], 'stages' => ['Preparatory', 'Secondary']],
            ['name' => ['en' => 'Physics', 'ar' => 'الفيزياء'], 'stages' => ['Secondary']],
            ['name' => ['en' => 'Chemistry', 'ar' => 'الكيمياء'], 'stages' => ['Secondary']],
            ['name' => ['en' => 'Biology', 'ar' => 'الأحياء'], 'stages' => ['Secondary']],
            ['name' => ['en' => 'History', 'ar' => 'التاريخ'], 'stages' => ['Secondary']],
        ];

        $stagesByEnName = Stage::all()->keyBy(fn (Stage $stage) => $stage->getTranslation('name', 'en'));

        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead, to keep this seeder safe to run more than once.
        $existingEnNames = Subject::all()
            ->map(fn (Subject $subject) => $subject->getTranslation('name', 'en'))
            ->all();

        foreach ($subjects as $row) {
            if (in_array($row['name']['en'], $existingEnNames, true)) {
                continue;
            }

            $subject = Subject::create(['name' => $row['name']]);

            $stageIds = collect($row['stages'])
                ->map(fn (string $stageName) => $stagesByEnName->get($stageName)?->id)
                ->filter()
                ->all();

            $subject->stages()->sync($stageIds);
        }
    }
}
