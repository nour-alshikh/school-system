<?php

namespace App\TypeScript;

use App\Models\Promotion;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class PromotionType
{
    public function __construct(
        public readonly int $id,
        public readonly int $student_id,
        public readonly string $student_name_en,
        public readonly string $student_name_ar,
        public readonly StageType $from_stage,
        public readonly GradeType $from_grade,
        public readonly ClassroomType $from_classroom,
        public readonly AcademicYearType $from_academic_year,
        public readonly StageType $to_stage,
        public readonly GradeType $to_grade,
        public readonly ClassroomType $to_classroom,
        public readonly AcademicYearType $to_academic_year,
        public readonly ?string $promoted_by_name,
        public readonly string $created_at,
        public readonly ?string $rolled_back_at,
        public readonly ?string $rolled_back_by_name,
    ) {}

    public static function fromModel(Promotion $promotion): self
    {
        return new self(
            id: $promotion->id,
            student_id: $promotion->student_id,
            student_name_en: $promotion->student->getTranslation('name', 'en'),
            student_name_ar: $promotion->student->getTranslation('name', 'ar'),
            from_stage: StageType::fromModel($promotion->fromStage),
            from_grade: GradeType::fromModel($promotion->fromGrade),
            from_classroom: ClassroomType::fromModel($promotion->fromClassroom),
            from_academic_year: AcademicYearType::fromModel($promotion->fromAcademicYear),
            to_stage: StageType::fromModel($promotion->toStage),
            to_grade: GradeType::fromModel($promotion->toGrade),
            to_classroom: ClassroomType::fromModel($promotion->toClassroom),
            to_academic_year: AcademicYearType::fromModel($promotion->toAcademicYear),
            promoted_by_name: $promotion->promotedBy?->name,
            created_at: $promotion->created_at->toJSON(),
            rolled_back_at: $promotion->rolled_back_at?->toJSON(),
            rolled_back_by_name: $promotion->rolledBackBy?->name,
        );
    }
}
