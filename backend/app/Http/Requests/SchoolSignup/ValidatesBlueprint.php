<?php

namespace App\Http\Requests\SchoolSignup;

use App\Services\SchoolBlueprint;

/**
 * A new school may come with a blueprint from "Describe your school"
 * (docs/ai-assistant-plan.md, phase 2), applied when it's created. Optional;
 * when sent, it's held to SchoolBlueprint's limits.
 */
trait ValidatesBlueprint
{
    protected function blueprintRules(): array
    {
        return [
            'blueprint' => ['nullable', 'array'],
            ...($this->filled('blueprint') ? SchoolBlueprint::rules('blueprint.') : []),
        ];
    }

    public function after(): array
    {
        return $this->filled('blueprint') ? [SchoolBlueprint::after('blueprint.')] : [];
    }
}
