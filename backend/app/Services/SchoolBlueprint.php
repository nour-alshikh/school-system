<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\Subject;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator as ValidatorFactory;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

/**
 * A school's starting setup as data (docs/ai-assistant-plan.md, phase 2):
 * stages › grades › classrooms, subjects across stages, the academic year,
 * school days and currency. Drafted by AI from a sentence on the landing
 * page (SchoolBlueprintDrafter), edited by the visitor, then applied when
 * the school is created. SchoolStructureTemplate's standard structure is
 * the default blueprint.
 *
 * Shape (also App\TypeScript\SchoolBlueprintType):
 *   stages:   [{name_en, name_ar, grades: [{name_en, name_ar, classrooms: ["A", "B"]}]}]
 *   subjects: [{name_en, name_ar, stages: [stage index, …]}]
 *   academic_year: 2026, school_days: [0..6]|null, currency: "EGP"|null
 */
class SchoolBlueprint
{
    public const MAX_STAGES = 4;

    /** Across all stages. */
    public const MAX_GRADES = 15;

    public const MAX_CLASSROOMS_PER_GRADE = 6;

    public const MAX_SUBJECTS = 40;

    public const MAX_NAME = 100;

    public const MAX_SECTION = 20;

    /** Every classroom starts with this capacity, like the standard structure. */
    private const CAPACITY = 30;

    /**
     * Validation rules for a blueprint under $prefix (e.g. "blueprint."):
     * the hard limits that keep a visitor's edits — or an AI reply — from
     * building something absurd. Pair with after().
     */
    public static function rules(string $prefix = ''): array
    {
        $year = now()->year;

        return [
            "{$prefix}stages" => ['required', 'array', 'min:1', 'max:'.self::MAX_STAGES],
            "{$prefix}stages.*.name_en" => ['required', 'string', 'max:'.self::MAX_NAME, 'distinct:ignore_case'],
            "{$prefix}stages.*.name_ar" => ['required', 'string', 'max:'.self::MAX_NAME],
            "{$prefix}stages.*.grades" => ['required', 'array', 'min:1', 'max:'.self::MAX_GRADES],
            "{$prefix}stages.*.grades.*.name_en" => ['required', 'string', 'max:'.self::MAX_NAME],
            "{$prefix}stages.*.grades.*.name_ar" => ['required', 'string', 'max:'.self::MAX_NAME],
            "{$prefix}stages.*.grades.*.classrooms" => ['required', 'array', 'min:1', 'max:'.self::MAX_CLASSROOMS_PER_GRADE],
            // Not "distinct": on a nested wildcard it compares across every grade.
            // Duplicates within one grade are caught in after().
            "{$prefix}stages.*.grades.*.classrooms.*" => ['required', 'string', 'max:'.self::MAX_SECTION],
            "{$prefix}subjects" => ['present', 'array', 'max:'.self::MAX_SUBJECTS],
            "{$prefix}subjects.*.name_en" => ['required', 'string', 'max:'.self::MAX_NAME, 'distinct:ignore_case'],
            "{$prefix}subjects.*.name_ar" => ['required', 'string', 'max:'.self::MAX_NAME],
            "{$prefix}subjects.*.stages" => ['required', 'array', 'min:1'],
            "{$prefix}subjects.*.stages.*" => ['integer', 'min:0', 'max:'.(self::MAX_STAGES - 1)],
            "{$prefix}academic_year" => ['required', 'integer', 'between:'.($year - 1).','.($year + 1)],
            "{$prefix}school_days" => ['nullable', 'array', 'min:1', 'max:7'],
            "{$prefix}school_days.*" => ['integer', 'between:0,6', 'distinct'],
            "{$prefix}currency" => ['nullable', 'string', Rule::in(config('schools.currencies'))],
        ];
    }

    /**
     * Checks across fields that rules() can't express: the total grade
     * count, distinct sections within a grade, and subjects pointing at
     * stages that exist. For a FormRequest's
     * after() or a Validator.
     */
    public static function after(string $prefix = ''): callable
    {
        return function (Validator $validator) use ($prefix) {
            $data = data_get($validator->getData(), rtrim($prefix, '.'));
            $stages = is_array($data['stages'] ?? null) ? $data['stages'] : [];

            $grades = array_sum(array_map(fn ($s) => is_array($s['grades'] ?? null) ? count($s['grades']) : 0, $stages));
            if ($grades > self::MAX_GRADES) {
                $validator->errors()->add("{$prefix}stages", __('validation.blueprint_too_many_grades', ['max' => self::MAX_GRADES]));
            }

            foreach ($stages as $s => $stage) {
                foreach (is_array($stage['grades'] ?? null) ? $stage['grades'] : [] as $g => $grade) {
                    $sections = array_map(fn ($c) => is_string($c) ? mb_strtolower(trim($c)) : $c, is_array($grade['classrooms'] ?? null) ? $grade['classrooms'] : []);
                    if (count($sections) !== count(array_unique($sections, SORT_REGULAR))) {
                        $validator->errors()->add("{$prefix}stages.{$s}.grades.{$g}.classrooms", __('validation.blueprint_duplicate_classroom'));
                    }
                }
            }

            foreach (is_array($data['subjects'] ?? null) ? $data['subjects'] : [] as $i => $subject) {
                foreach (is_array($subject['stages'] ?? null) ? $subject['stages'] : [] as $index) {
                    if (is_int($index) && ! isset($stages[$index])) {
                        $validator->errors()->add("{$prefix}subjects.{$i}.stages", __('validation.blueprint_unknown_stage'));
                    }
                }
            }
        };
    }

    /**
     * $blueprint validated on its own (not inside a request).
     *
     * @throws ValidationException
     */
    public static function validate(array $blueprint): array
    {
        $validator = ValidatorFactory::make($blueprint, self::rules());
        $validator->after(self::after());

        return $validator->validate();
    }

    /** The standard structure (SchoolStructureTemplate) as a blueprint, one classroom per grade. */
    public static function default(): array
    {
        $stageIndex = [];
        $stages = [];

        foreach (SchoolStructureTemplate::STAGES as $i => $stage) {
            $stageIndex[$stage['name']['en']] = $i;
            $stages[] = [
                'name_en' => $stage['name']['en'],
                'name_ar' => $stage['name']['ar'],
                'grades' => array_map(fn ($g) => ['name_en' => $g['en'], 'name_ar' => $g['ar'], 'classrooms' => ['A']], $stage['grades']),
            ];
        }

        return [
            'school_name' => null,
            'slug' => null,
            'stages' => $stages,
            'subjects' => array_map(fn ($s) => [
                'name_en' => $s['name']['en'],
                'name_ar' => $s['name']['ar'],
                'stages' => array_map(fn ($name) => $stageIndex[$name], $s['stages']),
            ], SchoolStructureTemplate::SUBJECTS),
            'academic_year' => now()->year,
            'school_days' => null,
            'currency' => null,
            'notes' => [],
        ];
    }

    /**
     * Builds the blueprint at the current school, in one transaction:
     * academic year (unless one is current), stages, grades, classrooms
     * named "{grade} - {section}", subjects, and the currency and school
     * days when given. Refused once the school has stages, so it never
     * merges into a structure built by hand. Validate first.
     *
     * @throws ValidationException
     */
    public function apply(array $blueprint): void
    {
        if (Stage::exists()) {
            throw ValidationException::withMessages(['structure' => __('api.structure_exists')]);
        }

        DB::transaction(function () use ($blueprint) {
            if (! AcademicYear::where('is_current', true)->exists()) {
                AcademicYear::firstOrCreate(['year' => $blueprint['academic_year']], ['is_current' => true]);
            }

            $stageIds = [];
            foreach ($blueprint['stages'] as $i => $row) {
                $stage = Stage::create(['name' => ['en' => $row['name_en'], 'ar' => $row['name_ar']]]);
                $stageIds[$i] = $stage->id;

                foreach ($row['grades'] as $gradeRow) {
                    $grade = Grade::create(['stage_id' => $stage->id, 'name' => ['en' => $gradeRow['name_en'], 'ar' => $gradeRow['name_ar']]]);

                    foreach ($gradeRow['classrooms'] as $section) {
                        Classroom::create(['grade_id' => $grade->id, 'name' => "{$gradeRow['name_en']} - {$section}", 'capacity' => self::CAPACITY]);
                    }
                }
            }

            foreach ($blueprint['subjects'] as $row) {
                Subject::create(['name' => ['en' => $row['name_en'], 'ar' => $row['name_ar']]])
                    ->stages()
                    ->sync(array_values(array_unique(array_map(fn ($i) => $stageIds[$i], $row['stages']))));
            }

            if (filled($blueprint['currency'] ?? null)) {
                Setting::where('key', 'currency')->update(['value' => $blueprint['currency']]);
            }

            if (! empty($blueprint['school_days'])) {
                $days = array_values(array_unique(array_map('intval', $blueprint['school_days'])));
                sort($days);
                Setting::where('key', 'school_days')->update(['value' => implode(',', $days)]);
            }
        });
    }
}
