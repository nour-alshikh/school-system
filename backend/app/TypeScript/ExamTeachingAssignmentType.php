<?php

namespace App\TypeScript;

use App\Models\ClassroomSubjectTeacher;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One classroom+subject combination a teacher holds — what populates the
 * exam form's picker for a teacher, who can't reach the general
 * /api/classrooms or /api/subjects endpoints. See
 * ExamController::teachingAssignments().
 */
#[TypeScript]
final class ExamTeachingAssignmentType
{
    public function __construct(
        public readonly int $classroom_id,
        public readonly string $classroom_name,
        public readonly int $subject_id,
        public readonly string $subject_name_en,
        public readonly string $subject_name_ar,
        public readonly int $grade_id,
        public readonly string $grade_name_en,
        public readonly string $grade_name_ar,
    ) {}

    public static function fromModel(ClassroomSubjectTeacher $assignment): self
    {
        return new self(
            classroom_id: $assignment->classroom->id,
            classroom_name: $assignment->classroom->name,
            subject_id: $assignment->subject->id,
            subject_name_en: $assignment->subject->getTranslation('name', 'en'),
            subject_name_ar: $assignment->subject->getTranslation('name', 'ar'),
            grade_id: $assignment->classroom->grade->id,
            grade_name_en: $assignment->classroom->grade->getTranslation('name', 'en'),
            grade_name_ar: $assignment->classroom->grade->getTranslation('name', 'ar'),
        );
    }
}
