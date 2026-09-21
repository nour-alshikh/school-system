<?php

namespace App\TypeScript;

use App\Models\ClassroomSubjectTeacher;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentClassSubjectType
{
    public function __construct(
        public readonly int $subject_id,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly ?string $teacher_name,
        public readonly ?string $teacher_email,
        public readonly ?string $teacher_phone,
    ) {}

    public static function fromModel(ClassroomSubjectTeacher $assignment): self
    {
        return new self(
            subject_id: $assignment->subject_id,
            subject_name_en: $assignment->subject->getTranslation('name', 'en'),
            subject_name_ar: $assignment->subject->getTranslation('name', 'ar'),
            teacher_name: $assignment->teacher?->name,
            teacher_email: $assignment->teacher?->email,
            teacher_phone: $assignment->teacher?->phone,
        );
    }
}
