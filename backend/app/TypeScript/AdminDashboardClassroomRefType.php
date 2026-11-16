<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A classroom reference: its name plus its grade's name, e.g. "Grade 3 · A". */
#[TypeScript]
final class AdminDashboardClassroomRefType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $grade_name_en,
        public readonly string $grade_name_ar,
    ) {}
}
