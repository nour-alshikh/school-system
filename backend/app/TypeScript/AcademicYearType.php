<?php

namespace App\TypeScript;

use App\Models\AcademicYear;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AcademicYearType
{
    public function __construct(
        public readonly int $id,
        public readonly int $year,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly bool $is_current,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(AcademicYear $academicYear): self
    {
        // Both locales render the same digits — "2026/2027" needs no
        // translation — but the field stays name_en/name_ar so every other
        // lookup select (student wizard, academic-years list) keeps reading
        // it exactly like the other lookup types.
        $name = $academicYear->year.'/'.($academicYear->year + 1);

        return new self(
            id: $academicYear->id,
            year: $academicYear->year,
            name_en: $name,
            name_ar: $name,
            is_current: $academicYear->is_current,
            created_at: $academicYear->created_at->toJSON(),
            updated_at: $academicYear->updated_at->toJSON(),
        );
    }
}
