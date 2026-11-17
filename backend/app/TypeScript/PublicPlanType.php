<?php

namespace App\TypeScript;

use App\Models\Plan;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A plan as the public landing page shows it: limits and modules, nothing about schools. */
#[TypeScript]
final class PublicPlanType
{
    /**
     * @param  string[]  $features
     */
    public function __construct(
        public readonly string $key,
        public readonly string $name,
        public readonly ?int $max_students,
        public readonly ?int $max_storage_mb,
        public readonly array $features,
        /** New self-service schools start on this plan. */
        public readonly bool $self_service,
    ) {}

    public static function fromModel(Plan $plan): self
    {
        return new self(
            key: $plan->key,
            name: $plan->name,
            max_students: $plan->max_students,
            max_storage_mb: $plan->max_storage_mb,
            features: array_values($plan->features ?? []),
            self_service: $plan->key === config('schools.self_service_plan'),
        );
    }
}
