<?php

namespace App\TypeScript;

use App\Enums\Gender;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
        public readonly string $email,
        public readonly Gender $gender,
        public readonly int $nationality_id,
        public readonly int $governorate_id,
        public readonly int $blood_type_id,
        public readonly int $stage_id,
        public readonly int $grade_id,
        public readonly int $classroom_id,
        public readonly int $academic_year_id,
        public readonly string $parent_email,
        public readonly GuardianType $father,
        public readonly GuardianType $mother,
        /** @var string[] */
        public readonly array $attachment_urls,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Student $student): self
    {
        return new self(
            id: $student->id,
            name_en: $student->getTranslation('name', 'en'),
            name_ar: $student->getTranslation('name', 'ar'),
            email: $student->user->email,
            gender: $student->gender,
            nationality_id: $student->nationality_id,
            governorate_id: $student->governorate_id,
            blood_type_id: $student->blood_type_id,
            stage_id: $student->stage_id,
            grade_id: $student->grade_id,
            classroom_id: $student->classroom_id,
            academic_year_id: $student->academic_year_id,
            parent_email: $student->parentUser->email,
            father: GuardianType::fromModel($student->father),
            mother: GuardianType::fromModel($student->mother),
            attachment_urls: $student->getMedia('attachments')->map->getUrl()->all(),
            created_at: $student->created_at->toJSON(),
            updated_at: $student->updated_at->toJSON(),
        );
    }
}
