<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\Grade;
use App\Models\Stage;
use App\Models\Subject;

/**
 * A typical school's structure: three stages, twelve grades, a classroom
 * per section and the usual subjects. Used by the base seeders and by a new
 * school's "Create a standard structure" button (see
 * docs/self-service-schools-plan.md, phase 4). Works on the current school.
 *
 * Each step skips what already exists (matched by English name), so the
 * seeders stay safe to run more than once.
 */
class SchoolStructureTemplate
{
    /** Stage (en) => its grades, in order. */
    public const STAGES = [
        ['name' => ['en' => 'Primary', 'ar' => 'الابتدائية'], 'grades' => [
            ['en' => 'Grade 1', 'ar' => 'الصف الأول'],
            ['en' => 'Grade 2', 'ar' => 'الصف الثاني'],
            ['en' => 'Grade 3', 'ar' => 'الصف الثالث'],
            ['en' => 'Grade 4', 'ar' => 'الصف الرابع'],
            ['en' => 'Grade 5', 'ar' => 'الصف الخامس'],
            ['en' => 'Grade 6', 'ar' => 'الصف السادس'],
        ]],
        ['name' => ['en' => 'Preparatory', 'ar' => 'الإعدادية'], 'grades' => [
            ['en' => 'Grade 7', 'ar' => 'الصف السابع'],
            ['en' => 'Grade 8', 'ar' => 'الصف الثامن'],
            ['en' => 'Grade 9', 'ar' => 'الصف التاسع'],
        ]],
        ['name' => ['en' => 'Secondary', 'ar' => 'الثانوية'], 'grades' => [
            ['en' => 'Grade 10', 'ar' => 'الصف العاشر'],
            ['en' => 'Grade 11', 'ar' => 'الصف الحادي عشر'],
            ['en' => 'Grade 12', 'ar' => 'الصف الثاني عشر'],
        ]],
    ];

    /**
     * Each subject is scoped to every stage it's taught across (Subject::stages()
     * is many-to-many), not duplicated per stage — e.g. one "Mathematics" row
     * spans all three stages instead of three separate "Mathematics" subjects.
     */
    public const SUBJECTS = [
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

    /**
     * The whole structure for a school that has none yet: a current
     * academic year, stages, grades, one classroom per grade, subjects —
     * the default blueprint (SchoolBlueprint::default()). Refused once the
     * school has stages, so it never merges into a structure the admin
     * built by hand.
     */
    public function applyToEmptySchool(): void
    {
        app(SchoolBlueprint::class)->apply(SchoolBlueprint::default());
    }

    public function createStages(): void
    {
        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead.
        $existing = Stage::all()->map(fn (Stage $stage) => $stage->getTranslation('name', 'en'))->all();

        foreach (self::STAGES as $stage) {
            if (! in_array($stage['name']['en'], $existing, true)) {
                Stage::create(['name' => $stage['name']]);
            }
        }
    }

    public function createGrades(): void
    {
        $stages = $this->stagesByEnName();

        foreach (self::STAGES as $row) {
            $stage = $stages->get($row['name']['en']);
            if (! $stage) {
                continue;
            }

            $existing = $stage->grades()->get()->map(fn (Grade $grade) => $grade->getTranslation('name', 'en'))->all();

            foreach ($row['grades'] as $name) {
                if (! in_array($name['en'], $existing, true)) {
                    Grade::create(['stage_id' => $stage->id, 'name' => $name]);
                }
            }
        }
    }

    /**
     * One classroom per section in every grade, named "Grade 1 - A".
     *
     * @param  list<string>  $sections
     */
    public function createClassrooms(array $sections): void
    {
        Grade::all()->each(function (Grade $grade) use ($sections) {
            $gradeName = $grade->getTranslation('name', 'en');
            $existing = $grade->classrooms()->pluck('name')->all();

            foreach ($sections as $section) {
                $name = "{$gradeName} - {$section}";

                if (! in_array($name, $existing, true)) {
                    Classroom::create(['grade_id' => $grade->id, 'name' => $name, 'capacity' => 30]);
                }
            }
        });
    }

    public function createSubjects(): void
    {
        $stages = $this->stagesByEnName();
        $existing = Subject::all()->map(fn (Subject $subject) => $subject->getTranslation('name', 'en'))->all();

        foreach (self::SUBJECTS as $row) {
            if (in_array($row['name']['en'], $existing, true)) {
                continue;
            }

            $subject = Subject::create(['name' => $row['name']]);

            $subject->stages()->sync(
                collect($row['stages'])->map(fn (string $name) => $stages->get($name)?->id)->filter()->all()
            );
        }
    }

    private function stagesByEnName()
    {
        return Stage::all()->keyBy(fn (Stage $stage) => $stage->getTranslation('name', 'en'));
    }
}
