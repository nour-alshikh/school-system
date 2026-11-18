<?php

namespace App\Services\Ai\Drafts;

use App\Services\SchoolBlueprint;
use App\Services\StructureAdditions;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

/**
 * The assistant's "set up structure" (docs/ai-assistant-plan.md, phase 6):
 * a request like "add a secondary stage with 3 classes per grade" plus the
 * school's current structure (names only: stages, grades, classrooms,
 * subjects — no people) → only what to add, in StructureAdditions' shape.
 * Cleaned up leniently like a blueprint, then validated; StructureAdditions
 * then skips whatever already exists. Used by the SetUpStructure action,
 * not served on /api/ai/draft.
 */
class StructureAdditionsDrafter extends SchoolBlueprintDrafter
{
    protected int $maxTokens = 3000;

    public function kind(): string
    {
        return 'structure_additions';
    }

    protected function prompt(): string
    {
        $maxStages = SchoolBlueprint::MAX_STAGES;
        $maxGrades = SchoolBlueprint::MAX_GRADES;
        $maxClassrooms = SchoolBlueprint::MAX_CLASSROOMS_PER_GRADE;
        $maxSubjects = SchoolBlueprint::MAX_SUBJECTS;

        return <<<TXT
            You add to a school's structure in a school management system. You get the school's current structure and a request. Reply with ONLY what to add — never repeat what is already there unless it's the place new things go, and never remove or rename anything.
            - stages: at most {$maxStages}, in order. A new stage has its grades in order. To add grades or classrooms to an existing stage, repeat that stage's exact names with only the new grades; to add classrooms to an existing grade, repeat the stage and grade with only the new section names. At most {$maxGrades} grades in total.
            - classrooms: short section names such as "A", "B", "C" (at most {$maxClassrooms} per grade). For a new grade with no number given, follow the existing grades (same sections), or one ("A").
            - Every new name in English and in Modern Standard Arabic, the way schools there name them (Secondary = الثانوية, Grade 10 = الصف العاشر), continuing the existing naming and numbering.
            - subjects: at most {$maxSubjects}, each with "stages": 0-based indexes into YOUR stages list. For a new stage, include the usual subjects for it: existing subjects that fit (same names, so they're shared) and any new ones. To teach an existing subject in an existing stage, list that stage with "grades": [].
            - If the request isn't about the school's structure, or asks only to remove or rename things, reply {"stages":[],"subjects":[]}.
            Reply with JSON only, no other text: {"stages":[{"name_en":"Secondary","name_ar":"الثانوية","grades":[{"name_en":"Grade 10","name_ar":"الصف العاشر","classrooms":["A","B","C"]}]}],"subjects":[{"name_en":"Physics","name_ar":"الفيزياء","stages":[0]}]}
            TXT;
    }

    /** @param  array{current?: array}  $context */
    protected function message(string $notes, array $context): string
    {
        $current = $context['current'] ?? StructureAdditions::current();

        return "Current structure:\n".json_encode($current, JSON_UNESCAPED_UNICODE)."\n\nRequest:\n{$notes}";
    }

    protected function shape(array $data): array
    {
        $stages = $this->stages($data['stages'] ?? null, keepEmpty: true);
        $additions = [
            'stages' => $stages,
            // Subjects point at the stages given; with none, they have nowhere to go.
            'subjects' => $stages === [] ? [] : $this->subjects($data['subjects'] ?? null, count($stages)),
        ];

        if ($additions['stages'] === [] && $additions['subjects'] === []) {
            throw new RuntimeException('Structure additions are empty');
        }

        $validator = Validator::make($additions, StructureAdditions::rules());
        $validator->after(StructureAdditions::after());
        if ($validator->fails()) {
            throw new RuntimeException('Structure additions failed validation: '.json_encode($validator->errors()->toArray()));
        }

        return $additions;
    }
}
