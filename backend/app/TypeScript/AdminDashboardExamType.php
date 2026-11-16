<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** An upcoming published exam. */
#[TypeScript]
final class AdminDashboardExamType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly string $opens_at,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly string $grade_name_en,
        public readonly string $grade_name_ar,
        public readonly ?string $classroom_name,
    ) {}
}
