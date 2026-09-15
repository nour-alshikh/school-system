<?php

namespace App\TypeScript;

use App\Models\BloodType;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class BloodTypeType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(BloodType $bloodType): self
    {
        return new self(
            id: $bloodType->id,
            name_en: $bloodType->getTranslation('name', 'en'),
            name_ar: $bloodType->getTranslation('name', 'ar'),
            created_at: $bloodType->created_at->toJSON(),
            updated_at: $bloodType->updated_at->toJSON(),
        );
    }
}
