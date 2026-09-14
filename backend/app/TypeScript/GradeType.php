<?php

namespace App\TypeScript;

use App\Models\Grade;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class GradeType
{
    public function __construct(
        public readonly int $id,
        public readonly int $stage_id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Grade $grade): self
    {
        return new self(
            id: $grade->id,
            stage_id: $grade->stage_id,
            name_en: $grade->getTranslation('name', 'en'),
            name_ar: $grade->getTranslation('name', 'ar'),
            created_at: $grade->created_at->toJSON(),
            updated_at: $grade->updated_at->toJSON(),
        );
    }
}
