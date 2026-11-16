<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** Active students in one stage. */
#[TypeScript]
final class AdminDashboardStageCountType
{
    public function __construct(
        public readonly int $stage_id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly int $count,
    ) {}
}
