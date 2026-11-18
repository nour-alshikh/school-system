<?php

namespace App\Services;

use App\Models\Classroom;
use App\Models\Grade;
use App\Models\Stage;
use App\Models\Subject;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

/**
 * Adding to an existing school's structure (docs/ai-assistant-plan.md,
 * phase 6, "set up structure"): the assistant's "add a secondary stage
 * with 3 classes per grade" as data, merged into what's there. Unlike
 * SchoolBlueprint::apply(), which only builds into an empty school, this
 * matches each stage, grade, classroom and subject by name and skips the
 * ones that exist — it never renames, moves or removes anything.
 *
 * Shape (SchoolBlueprint's names; an existing stage or grade is named
 * again to add under it, with an empty list when nothing goes under it):
 *   stages:   [{name_en, name_ar, grades: [{name_en, name_ar, classrooms: ["A", "B"]}]}]
 *   subjects: [{name_en, name_ar, stages: [stage index, …]}]
 * A subject that exists gains the stages it doesn't have yet.
 */
class StructureAdditions
{
    /** New classrooms start with this capacity, as in SchoolBlueprint. */
    private const CAPACITY = 30;

    public static function rules(string $prefix = ''): array
    {
        $name = ['required', 'string', 'max:'.SchoolBlueprint::MAX_NAME];

        return [
            "{$prefix}stages" => ['present', 'array', 'max:'.SchoolBlueprint::MAX_STAGES],
            "{$prefix}stages.*.name_en" => [...$name, 'distinct:ignore_case'],
            "{$prefix}stages.*.name_ar" => $name,
            "{$prefix}stages.*.grades" => ['present', 'array', 'max:'.SchoolBlueprint::MAX_GRADES],
            "{$prefix}stages.*.grades.*.name_en" => $name,
            "{$prefix}stages.*.grades.*.name_ar" => $name,
            "{$prefix}stages.*.grades.*.classrooms" => ['present', 'array', 'max:'.SchoolBlueprint::MAX_CLASSROOMS_PER_GRADE],
            "{$prefix}stages.*.grades.*.classrooms.*" => ['required', 'string', 'max:'.SchoolBlueprint::MAX_SECTION],
            "{$prefix}subjects" => ['present', 'array', 'max:'.SchoolBlueprint::MAX_SUBJECTS],
            "{$prefix}subjects.*.name_en" => [...$name, 'distinct:ignore_case'],
            "{$prefix}subjects.*.name_ar" => $name,
            "{$prefix}subjects.*.stages" => ['present', 'array'],
            "{$prefix}subjects.*.stages.*" => ['integer', 'min:0', 'max:'.(SchoolBlueprint::MAX_STAGES - 1)],
        ];
    }

    /** SchoolBlueprint's cross-field checks (grade total, sections, stage indexes), which fit this shape too. */
    public static function after(string $prefix = ''): callable
    {
        return function (Validator $validator) use ($prefix) {
            SchoolBlueprint::after($prefix)($validator);

            // No prefix: the whole data (data_get with '' would return null).
            $data = $prefix === '' ? $validator->getData() : data_get($validator->getData(), rtrim($prefix, '.'));
            if (empty($data['stages']) && empty($data['subjects'])) {
                $validator->errors()->add("{$prefix}stages", __('validation.structure_additions_empty'));
            }
        };
    }

    /**
     * What applying $additions would add, matched against the current
     * school: only the new parts, with existing stages and grades kept as
     * the place they go. Grades and stages with nothing new are left out.
     *
     * @return array{stages: list<array>, subjects: list<array>, counts: array{stages: int, grades: int, classrooms: int, subjects: int, subject_stages: int}, skipped: int}
     */
    public function plan(array $additions): array
    {
        return $this->build($additions)['plan'];
    }

    /**
     * Adds what plan() shows, in one transaction, matched again at the time
     * of saving. Validate first.
     *
     * @return array{stages: int, grades: int, classrooms: int, subjects: int, subject_stages: int}
     */
    public function apply(array $additions): array
    {
        return DB::transaction(function () use ($additions) {
            ['plan' => $plan, 'stageRefs' => $stageRefs] = $this->build($additions);
            $stageIds = [];

            foreach ($plan['stages'] as $stageRow) {
                $stage = $stageRow['id'] ? Stage::findOrFail($stageRow['id']) : Stage::create(['name' => ['en' => $stageRow['name_en'], 'ar' => $stageRow['name_ar']]]);
                $stageIds[$stageRow['key']] = $stage->id;

                foreach ($stageRow['grades'] as $gradeRow) {
                    $grade = $gradeRow['id']
                        ? Grade::findOrFail($gradeRow['id'])
                        : Grade::create(['stage_id' => $stage->id, 'name' => ['en' => $gradeRow['name_en'], 'ar' => $gradeRow['name_ar']]]);

                    foreach ($gradeRow['classrooms'] as $name) {
                        Classroom::create(['grade_id' => $grade->id, 'name' => $name, 'capacity' => self::CAPACITY]);
                    }
                }
            }

            foreach ($plan['subjects'] as $subjectRow) {
                $ids = array_values(array_unique(array_filter(array_map(
                    fn (string $key) => $stageIds[$key] ?? $stageRefs[$key] ?? null,
                    $subjectRow['stage_keys'],
                ))));

                $subject = $subjectRow['id']
                    ? Subject::findOrFail($subjectRow['id'])
                    : Subject::create(['name' => ['en' => $subjectRow['name_en'], 'ar' => $subjectRow['name_ar']]]);
                $subject->stages()->syncWithoutDetaching($ids);
            }

            return $plan['counts'];
        });
    }

    /** The current structure, small enough for a prompt: stages › grades › classrooms, and subjects with their stages. */
    public static function current(): array
    {
        $stages = Stage::with(['grades' => fn ($q) => $q->orderBy('id'), 'grades.classrooms' => fn ($q) => $q->orderBy('name')])->orderBy('id')->get();

        return [
            'stages' => $stages->map(fn (Stage $stage) => [
                'name_en' => $stage->getTranslation('name', 'en', false),
                'name_ar' => $stage->getTranslation('name', 'ar', false),
                'grades' => $stage->grades->map(fn (Grade $grade) => [
                    'name_en' => $grade->getTranslation('name', 'en', false),
                    'name_ar' => $grade->getTranslation('name', 'ar', false),
                    'classrooms' => $grade->classrooms->pluck('name')->all(),
                ])->all(),
            ])->all(),
            'subjects' => Subject::with('stages')->orderBy('id')->get()->map(fn (Subject $subject) => [
                'name_en' => $subject->getTranslation('name', 'en', false),
                'name_ar' => $subject->getTranslation('name', 'ar', false),
                'stages' => $subject->stages->map(fn (Stage $s) => $s->getTranslation('name', 'en', false))->all(),
            ])->all(),
        ];
    }

    /**
     * The plan, plus each additions stage index → its key in the plan
     * (existing stages that add nothing under them are still referenced
     * by subjects, so they're resolved to ids here).
     */
    private function build(array $additions): array
    {
        $existingStages = Stage::with(['grades.classrooms'])->get();
        $counts = ['stages' => 0, 'grades' => 0, 'classrooms' => 0, 'subjects' => 0, 'subject_stages' => 0];
        $skipped = 0;
        $planStages = [];
        $stageRefs = [];   // key => existing stage id
        $stageKeys = [];   // additions index => key
        $stageNames = [];  // key => {name_en, name_ar}

        foreach ($additions['stages'] ?? [] as $i => $row) {
            $stage = $this->match($existingStages, $row);
            $key = $stage ? "id:{$stage->id}" : "new:{$i}";
            $stageKeys[$i] = $key;
            $stageNames[$key] = $stage
                ? ['name_en' => $stage->getTranslation('name', 'en', false), 'name_ar' => $stage->getTranslation('name', 'ar', false)]
                : ['name_en' => $row['name_en'], 'name_ar' => $row['name_ar']];
            if ($stage) {
                $stageRefs[$key] = $stage->id;
            }

            $grades = [];
            foreach ($row['grades'] ?? [] as $gradeRow) {
                $grade = $stage ? $this->match($stage->grades, $gradeRow) : null;
                $gradeName = $grade ? $grade->getTranslation('name', 'en', false) : $gradeRow['name_en'];
                $have = $grade ? $grade->classrooms->map(fn (Classroom $c) => mb_strtolower(trim($c->name)))->all() : [];

                $new = [];
                foreach ($gradeRow['classrooms'] ?? [] as $section) {
                    $name = "{$gradeName} - ".trim($section);
                    if (in_array(mb_strtolower($name), $have, true) || in_array(mb_strtolower(trim($section)), $have, true)) {
                        $skipped++;

                        continue;
                    }
                    $have[] = mb_strtolower($name);
                    $new[] = $name;
                }

                if ($grade && $new === []) {
                    $skipped++;

                    continue;
                }

                $counts['grades'] += $grade ? 0 : 1;
                $counts['classrooms'] += count($new);
                $grades[] = [
                    'id' => $grade?->id,
                    'name_en' => $grade ? $grade->getTranslation('name', 'en', false) : $gradeRow['name_en'],
                    'name_ar' => $grade ? $grade->getTranslation('name', 'ar', false) : $gradeRow['name_ar'],
                    'classrooms' => $new,
                ];
            }

            if ($stage && $grades === []) {
                continue;
            }

            $counts['stages'] += $stage ? 0 : 1;
            $planStages[] = [
                'key' => $key,
                'id' => $stage?->id,
                'name_en' => $stage ? $stage->getTranslation('name', 'en', false) : $row['name_en'],
                'name_ar' => $stage ? $stage->getTranslation('name', 'ar', false) : $row['name_ar'],
                'grades' => $grades,
            ];
        }

        $existingSubjects = Subject::with('stages')->get();
        $planSubjects = [];
        foreach ($additions['subjects'] ?? [] as $row) {
            $subject = $this->match($existingSubjects, $row);
            $have = $subject ? $subject->stages->map(fn (Stage $s) => "id:{$s->id}")->all() : [];
            $keys = array_values(array_unique(array_filter(
                array_map(fn ($i) => $stageKeys[$i] ?? null, $row['stages'] ?? []),
                fn ($key) => $key !== null && ! in_array($key, $have, true),
            )));

            if ($subject && $keys === []) {
                $skipped++;

                continue;
            }

            $counts['subjects'] += $subject ? 0 : 1;
            $counts['subject_stages'] += $subject ? count($keys) : 0;
            $planSubjects[] = [
                'id' => $subject?->id,
                'name_en' => $subject ? $subject->getTranslation('name', 'en', false) : $row['name_en'],
                'name_ar' => $subject ? $subject->getTranslation('name', 'ar', false) : $row['name_ar'],
                'stage_keys' => $keys,
                'stages' => array_map(fn ($key) => $stageNames[$key], $keys),
            ];
        }

        return [
            'plan' => ['stages' => $planStages, 'subjects' => $planSubjects, 'counts' => $counts, 'skipped' => $skipped],
            'stageRefs' => $stageRefs,
        ];
    }

    /** The model in $existing with the same English or Arabic name (ignoring case and spaces at the ends). */
    private function match(Collection $existing, array $row): mixed
    {
        $en = mb_strtolower(trim($row['name_en'] ?? ''));
        $ar = trim($row['name_ar'] ?? '');

        return $existing->first(fn ($model) => ($en !== '' && mb_strtolower(trim((string) $model->getTranslation('name', 'en', false))) === $en)
            || ($ar !== '' && trim((string) $model->getTranslation('name', 'ar', false)) === $ar));
    }
}
