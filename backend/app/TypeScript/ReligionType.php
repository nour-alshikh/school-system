<?php

namespace App\TypeScript;

use App\Models\Religion;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ReligionType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Religion $religion): self
    {
        return new self(
            id: $religion->id,
            name_en: $religion->getTranslation('name', 'en'),
            name_ar: $religion->getTranslation('name', 'ar'),
            created_at: $religion->created_at->toJSON(),
            updated_at: $religion->updated_at->toJSON(),
        );
    }
}
