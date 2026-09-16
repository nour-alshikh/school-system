<?php

namespace App\TypeScript;

use App\Models\Subject;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class SubjectType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        /** @var int[] */
        public readonly array $stage_ids,
        /** @var int[] */
        public readonly array $grade_ids,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Subject $subject): self
    {
        return new self(
            id: $subject->id,
            name_en: $subject->getTranslation('name', 'en'),
            name_ar: $subject->getTranslation('name', 'ar'),
            stage_ids: $subject->stages->pluck('id')->all(),
            grade_ids: $subject->grades->pluck('id')->all(),
            created_at: $subject->created_at->toJSON(),
            updated_at: $subject->updated_at->toJSON(),
        );
    }
}
