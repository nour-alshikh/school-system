<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A count for one month ("YYYY-MM"). */
#[TypeScript]
final class AdminDashboardMonthCountType
{
    public function __construct(
        public readonly string $month,
        public readonly int $count,
    ) {}
}
