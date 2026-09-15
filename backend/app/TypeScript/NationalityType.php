<?php

namespace App\TypeScript;

use App\Models\Nationality;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class NationalityType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Nationality $nationality): self
    {
        return new self(
            id: $nationality->id,
            name_en: $nationality->getTranslation('name', 'en'),
            name_ar: $nationality->getTranslation('name', 'ar'),
            created_at: $nationality->created_at->toJSON(),
            updated_at: $nationality->updated_at->toJSON(),
        );
    }
}
