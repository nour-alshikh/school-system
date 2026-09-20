<?php

namespace App\TypeScript;

use App\Models\Fee;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class FeeType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly int $academic_year_id,
        public readonly string $amount,
        public readonly bool $is_active,
        public readonly bool $is_for_all,
        public readonly ?int $stage_id,
        public readonly ?int $grade_id,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Fee $fee): self
    {
        return new self(
            id: $fee->id,
            name_en: $fee->getTranslation('name', 'en'),
            name_ar: $fee->getTranslation('name', 'ar'),
            academic_year_id: $fee->academic_year_id,
            amount: (string) $fee->amount,
            is_active: $fee->is_active,
            is_for_all: $fee->is_for_all,
            stage_id: $fee->stage_id,
            grade_id: $fee->grade_id,
            created_at: $fee->created_at->toJSON(),
            updated_at: $fee->updated_at->toJSON(),
        );
    }
}
