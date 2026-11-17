<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * A school's starting setup, from a sentence on the landing page
 * (docs/ai-assistant-plan.md, phase 2): reviewed and edited before signup,
 * then applied by App\Services\SchoolBlueprint::apply().
 */
#[TypeScript]
final class SchoolBlueprintType
{
    public function __construct(
        /** A suggested name, only when the description gave one. */
        public readonly ?string $school_name,
        /** A suggested address from that name. */
        public readonly ?string $slug,
        /** @var BlueprintStageType[] */
        public readonly array $stages,
        /** @var BlueprintSubjectType[] */
        public readonly array $subjects,
        /** The academic year's start year (2026 for 2026/2027). */
        public readonly int $academic_year,
        /**
         * Weekday numbers, 0 = Sunday … 6 = Saturday; null to choose later.
         *
         * @var int[]|null
         */
        public readonly ?array $school_days,
        /** ISO 4217, one of config schools.currencies; null to choose later. */
        public readonly ?string $currency,
        /**
         * What was assumed, in the visitor's language ("Assumed two classrooms per grade").
         *
         * @var string[]
         */
        public readonly array $notes,
    ) {}

    public static function fromArray(array $blueprint): self
    {
        return new self(
            school_name: $blueprint['school_name'] ?? null,
            slug: $blueprint['slug'] ?? null,
            stages: array_map(BlueprintStageType::fromArray(...), $blueprint['stages']),
            subjects: array_map(BlueprintSubjectType::fromArray(...), $blueprint['subjects']),
            academic_year: $blueprint['academic_year'],
            school_days: $blueprint['school_days'] ?? null,
            currency: $blueprint['currency'] ?? null,
            notes: array_values($blueprint['notes'] ?? []),
        );
    }
}
