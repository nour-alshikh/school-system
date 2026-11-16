<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A student with an unpaid fee balance. */
#[TypeScript]
final class AdminDashboardOverdueType
{
    public function __construct(
        public readonly int $student_id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $outstanding,
    ) {}
}
