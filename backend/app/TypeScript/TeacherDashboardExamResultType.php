<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A closed exam of the teacher's with its class average, for the performance chart. */
#[TypeScript]
final class TeacherDashboardExamResultType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly string $closes_at,
        public readonly int $submitted_count,
        public readonly int $eligible_count,
        /** Average score as 0–100, one decimal; null with no submissions. */
        public readonly ?float $average_percent,
    ) {}
}
