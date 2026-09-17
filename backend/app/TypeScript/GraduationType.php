<?php

namespace App\TypeScript;

use App\Models\Graduation;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class GraduationType
{
    public function __construct(
        public readonly int $id,
        public readonly int $student_id,
        public readonly string $student_name_en,
        public readonly string $student_name_ar,
        public readonly StageType $stage,
        public readonly GradeType $grade,
        public readonly ClassroomType $classroom,
        public readonly AcademicYearType $academic_year,
        public readonly ?string $graduated_by_name,
        public readonly string $created_at,
        public readonly ?string $rolled_back_at,
        public readonly ?string $rolled_back_by_name,
    ) {}

    public static function fromModel(Graduation $graduation): self
    {
        return new self(
            id: $graduation->id,
            student_id: $graduation->student_id,
            student_name_en: $graduation->student->getTranslation('name', 'en'),
            student_name_ar: $graduation->student->getTranslation('name', 'ar'),
            stage: StageType::fromModel($graduation->stage),
            grade: GradeType::fromModel($graduation->grade),
            classroom: ClassroomType::fromModel($graduation->classroom),
            academic_year: AcademicYearType::fromModel($graduation->academicYear),
            graduated_by_name: $graduation->graduatedBy?->name,
            created_at: $graduation->created_at->toJSON(),
            rolled_back_at: $graduation->rolled_back_at?->toJSON(),
            rolled_back_by_name: $graduation->rolledBackBy?->name,
        );
    }
}
