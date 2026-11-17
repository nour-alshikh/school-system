<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A stage in a school blueprint (App\Services\SchoolBlueprint). */
#[TypeScript]
final class BlueprintStageType
{
    public function __construct(
        public readonly string $name_en,
        public readonly string $name_ar,
        /** @var BlueprintGradeType[] */
        public readonly array $grades,
    ) {}

    public static function fromArray(array $stage): self
    {
        return new self($stage['name_en'], $stage['name_ar'], array_map(BlueprintGradeType::fromArray(...), $stage['grades']));
    }
}
