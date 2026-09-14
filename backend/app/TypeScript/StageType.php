<?php

namespace App\TypeScript;

use App\Models\Stage;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StageType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Stage $stage): self
    {
        return new self(
            id: $stage->id,
            name_en: $stage->getTranslation('name', 'en'),
            name_ar: $stage->getTranslation('name', 'ar'),
            created_at: $stage->created_at->toJSON(),
            updated_at: $stage->updated_at->toJSON(),
        );
    }
}
