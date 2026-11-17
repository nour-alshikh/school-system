<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A subject in a school blueprint (App\Services\SchoolBlueprint). */
#[TypeScript]
final class BlueprintSubjectType
{
    public function __construct(
        public readonly string $name_en,
        public readonly string $name_ar,
        /**
         * Indexes into the blueprint's stages: the subject is taught across them.
         *
         * @var int[]
         */
        public readonly array $stages,
    ) {}

    public static function fromArray(array $subject): self
    {
        return new self($subject['name_en'], $subject['name_ar'], array_values($subject['stages']));
    }
}
