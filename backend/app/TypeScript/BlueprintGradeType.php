<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A grade in a school blueprint (App\Services\SchoolBlueprint). */
#[TypeScript]
final class BlueprintGradeType
{
    public function __construct(
        public readonly string $name_en,
        public readonly string $name_ar,
        /**
         * Section names; each becomes a classroom "{grade} - {section}".
         *
         * @var string[]
         */
        public readonly array $classrooms,
    ) {}

    public static function fromArray(array $grade): self
    {
        return new self($grade['name_en'], $grade['name_ar'], array_values($grade['classrooms']));
    }
}
