<?php

namespace App\TypeScript;

use App\Models\ClassroomSubjectTeacher;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ClassroomSubjectTeacherType
{
    public function __construct(
        public readonly int $subject_id,
        public readonly int $teacher_id,
    ) {}

    public static function fromModel(ClassroomSubjectTeacher $assignment): self
    {
        return new self(
            subject_id: $assignment->subject_id,
            teacher_id: $assignment->teacher_id,
        );
    }
}
