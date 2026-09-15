<?php

namespace App\TypeScript;

use App\Models\AcademicYear;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AcademicYearType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly bool $is_current,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(AcademicYear $academicYear): self
    {
        return new self(
            id: $academicYear->id,
            name_en: $academicYear->getTranslation('name', 'en'),
            name_ar: $academicYear->getTranslation('name', 'ar'),
            is_current: $academicYear->is_current,
            created_at: $academicYear->created_at->toJSON(),
            updated_at: $academicYear->updated_at->toJSON(),
        );
    }
}
