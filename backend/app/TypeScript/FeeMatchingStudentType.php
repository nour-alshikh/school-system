<?php

namespace App\TypeScript;

use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * Deliberately narrower than StudentType — the "charge all matching
 * students" picker only needs a name to show next to an amount input, not
 * the full student record (which would also mean eager-loading nationality,
 * guardians, attachments, etc. just to serialize it).
 */
#[TypeScript]
final class FeeMatchingStudentType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
    ) {}

    public static function fromModel(Student $student): self
    {
        return new self(
            id: $student->id,
            name_en: $student->getTranslation('name', 'en'),
            name_ar: $student->getTranslation('name', 'ar'),
        );
    }
}
