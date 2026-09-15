<?php

namespace App\TypeScript;

use App\Models\Governorate;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class GovernorateType
{
    public function __construct(
        public readonly int $id,
        public readonly int $nationality_id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Governorate $governorate): self
    {
        return new self(
            id: $governorate->id,
            nationality_id: $governorate->nationality_id,
            name_en: $governorate->getTranslation('name', 'en'),
            name_ar: $governorate->getTranslation('name', 'ar'),
            created_at: $governorate->created_at->toJSON(),
            updated_at: $governorate->updated_at->toJSON(),
        );
    }
}
