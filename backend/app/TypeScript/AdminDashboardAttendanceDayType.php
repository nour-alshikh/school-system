<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** One day of the admin dashboard's attendance trend. All zero on a day nothing was marked. */
#[TypeScript]
final class AdminDashboardAttendanceDayType
{
    public function __construct(
        public readonly string $date,
        public readonly int $present,
        public readonly int $late,
        public readonly int $absent,
        public readonly int $excused,
    ) {}
}
