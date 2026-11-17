<?php

namespace App\Services\Ai\Drafts;

use App\Services\Ai\Drafter;
use App\Services\SchoolBlueprint;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * "Describe your school" (docs/ai-assistant-plan.md, phase 2): a visitor's
 * sentence → a SchoolBlueprint to review before signing up. Public, so it
 * only ever sees what the visitor typed (and the blueprint they're
 * refining). The reply is cleaned up leniently — out-of-range items are
 * cut, bad ones dropped — then validated with SchoolBlueprint's hard
 * limits; a reply with no usable stages fails, and the caller falls back
 * to the standard structure.
 */
class SchoolBlueprintDrafter extends Drafter
{
    protected float $temperature = 0.3;

    protected int $maxTokens = 4000;

    public function kind(): string
    {
        return 'school_blueprint';
    }

    protected function prompt(): string
    {
        $today = now()->toDateString();
        $language = app()->getLocale() === 'ar' ? 'Modern Standard Arabic' : 'English';
        $currencies = implode(', ', config('schools.currencies'));
        $maxStages = SchoolBlueprint::MAX_STAGES;
        $maxGrades = SchoolBlueprint::MAX_GRADES;
        $maxClassrooms = SchoolBlueprint::MAX_CLASSROOMS_PER_GRADE;
        $maxSubjects = SchoolBlueprint::MAX_SUBJECTS;

        return <<<TXT
            You set up new schools in a school management system. From a visitor's description of their school, propose its starting structure. Today is {$today}.
            - stages: the school's levels in order (for example Kindergarten, Primary, Preparatory, Secondary), at most {$maxStages}. Each has its grades in order; at most {$maxGrades} grades in total.
            - Each grade has classrooms: short section names such as "A", "B", "C" (at most {$maxClassrooms}). If the description doesn't say how many, use one and say so in notes.
            - Every name in English and in Modern Standard Arabic, written the way schools there name them (Primary = الابتدائية, Grade 1 = الصف الأول), not word-for-word.
            - subjects: the usual subjects for those stages (at most {$maxSubjects}), each with "stages": the 0-based indexes of the stages that teach it.
            - academic_year: the start year of the current or next academic year (2026 for 2026/2027).
            - school_days: weekday numbers, 0 = Sunday … 6 = Saturday, only when the description or its country makes them clear (Egypt and most Gulf countries: [0,1,2,3,4]); otherwise null.
            - currency: an ISO code from this list only when the country is clear: {$currencies}; otherwise null.
            - school_name: only when the description names the school; otherwise null.
            - notes: up to 6 short sentences in {$language} saying what you assumed, so the visitor can check it.
            - Leave out stages the description rules out. If the text isn't about a school, reply {"stages":[]}.
            - When a current structure is given, change it as the request says and keep everything else as it is.
            Reply with JSON only, no other text: {"school_name":null,"stages":[{"name_en":"Primary","name_ar":"الابتدائية","grades":[{"name_en":"Grade 1","name_ar":"الصف الأول","classrooms":["A"]}]}],"subjects":[{"name_en":"Mathematics","name_ar":"الرياضيات","stages":[0]}],"academic_year":2026,"school_days":null,"currency":null,"notes":[]}
            TXT;
    }

    /** @param  array{current?: array}  $context */
    protected function message(string $notes, array $context): string
    {
        if (empty($context['current'])) {
            return "Description:\n{$notes}";
        }

        $current = array_intersect_key($context['current'], array_flip(['school_name', 'stages', 'subjects', 'academic_year', 'school_days', 'currency']));

        return "Current structure:\n".json_encode($current, JSON_UNESCAPED_UNICODE)."\n\nChange it like this:\n{$notes}";
    }

    protected function shape(array $data): array
    {
        $stages = $this->stages($data['stages'] ?? null);
        if ($stages === []) {
            throw new RuntimeException('Blueprint has no usable stages');
        }

        $year = filter_var($data['academic_year'] ?? null, FILTER_VALIDATE_INT);
        $days = array_values(array_unique(array_filter(
            array_map(fn ($d) => filter_var($d, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 6]]), is_array($data['school_days'] ?? null) ? $data['school_days'] : []),
            fn ($d) => $d !== false,
        )));
        sort($days);
        $currency = is_string($data['currency'] ?? null) ? strtoupper(trim($data['currency'])) : null;
        $name = $this->text($data, 'school_name', 255);
        $slug = $name !== null ? Str::limit(Str::slug($name), 63, '') : '';

        $blueprint = [
            'school_name' => $name,
            'slug' => strlen($slug) >= 3 ? trim($slug, '-') : null,
            'stages' => $stages,
            'subjects' => $this->subjects($data['subjects'] ?? null, count($stages)),
            'academic_year' => $year !== false && abs($year - now()->year) <= 1 ? $year : now()->year,
            'school_days' => $days ?: null,
            'currency' => in_array($currency, config('schools.currencies'), true) ? $currency : null,
            'notes' => array_slice(array_values(array_filter(array_map(
                fn ($n) => is_string($n) ? mb_substr(trim($n), 0, 200) : '',
                is_array($data['notes'] ?? null) ? $data['notes'] : [],
            ))), 0, 6),
        ];

        try {
            SchoolBlueprint::validate($blueprint);
        } catch (ValidationException $e) {
            throw new RuntimeException('Blueprint failed validation: '.json_encode($e->errors()), previous: $e);
        }

        return $blueprint;
    }

    /** Up to the stage and total-grade limits; a stage or grade without both names is dropped. */
    private function stages(mixed $rows): array
    {
        $stages = [];
        $gradesLeft = SchoolBlueprint::MAX_GRADES;
        $seen = [];

        foreach (is_array($rows) ? $rows : [] as $row) {
            if (count($stages) === SchoolBlueprint::MAX_STAGES || $gradesLeft === 0) {
                break;
            }
            $names = $this->names($row);
            if ($names === null || isset($seen[mb_strtolower($names['name_en'])])) {
                continue;
            }

            $grades = [];
            foreach (is_array($row['grades'] ?? null) ? $row['grades'] : [] as $gradeRow) {
                if ($gradesLeft === 0) {
                    break;
                }
                if ($gradeNames = $this->names($gradeRow)) {
                    $grades[] = [...$gradeNames, 'classrooms' => $this->sections($gradeRow['classrooms'] ?? null)];
                    $gradesLeft--;
                }
            }

            if ($grades !== []) {
                $seen[mb_strtolower($names['name_en'])] = true;
                $stages[] = [...$names, 'grades' => $grades];
            }
        }

        return $stages;
    }

    /** Distinct, trimmed section names; one ("A") when none are usable. */
    private function sections(mixed $values): array
    {
        $sections = [];
        foreach (is_array($values) ? $values : [] as $value) {
            $section = is_scalar($value) ? mb_substr(trim((string) $value), 0, SchoolBlueprint::MAX_SECTION) : '';
            if ($section !== '' && ! in_array(mb_strtolower($section), array_map('mb_strtolower', $sections), true)) {
                $sections[] = $section;
            }
        }

        return array_slice($sections, 0, SchoolBlueprint::MAX_CLASSROOMS_PER_GRADE) ?: ['A'];
    }

    /** Subjects with both names and at least one existing stage; duplicates by English name dropped. */
    private function subjects(mixed $rows, int $stageCount): array
    {
        $subjects = [];
        $seen = [];

        foreach (is_array($rows) ? $rows : [] as $row) {
            if (count($subjects) === SchoolBlueprint::MAX_SUBJECTS) {
                break;
            }
            $names = $this->names($row);
            $stages = array_values(array_unique(array_filter(
                array_map(fn ($i) => filter_var($i, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => $stageCount - 1]]), is_array($row['stages'] ?? null) ? $row['stages'] : []),
                fn ($i) => $i !== false,
            )));

            if ($names !== null && $stages !== [] && ! isset($seen[mb_strtolower($names['name_en'])])) {
                $seen[mb_strtolower($names['name_en'])] = true;
                $subjects[] = [...$names, 'stages' => $stages];
            }
        }

        return $subjects;
    }

    /** name_en/name_ar (or {name: {en, ar}}), trimmed and cut; null unless both are there. */
    private function names(mixed $row): ?array
    {
        if (! is_array($row)) {
            return null;
        }

        $pick = fn (string $lang) => mb_substr(trim((string) (is_scalar($row["name_{$lang}"] ?? null) ? $row["name_{$lang}"] : (is_array($row['name'] ?? null) && is_scalar($row['name'][$lang] ?? null) ? $row['name'][$lang] : ''))), 0, SchoolBlueprint::MAX_NAME);
        $en = $pick('en');
        $ar = $pick('ar');

        return $en !== '' && $ar !== '' ? ['name_en' => $en, 'name_ar' => $ar] : null;
    }
}
