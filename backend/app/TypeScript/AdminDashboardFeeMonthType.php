<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** One month ("YYYY-MM") of fees: charges raised that month vs payments received that month. */
#[TypeScript]
final class AdminDashboardFeeMonthType
{
    public function __construct(
        public readonly string $month,
        public readonly string $charged,
        public readonly string $collected,
    ) {}
}
