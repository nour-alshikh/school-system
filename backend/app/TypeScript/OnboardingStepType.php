<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class OnboardingStepType
{
    public function __construct(
        public readonly string $key,
        public readonly bool $done,
        /** How many exist, for steps that count something; null for branding. */
        public readonly ?int $count,
    ) {}
}
