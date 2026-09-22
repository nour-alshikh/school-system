<?php

namespace App\TypeScript;

use App\Models\Subject;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The subject shape a library resource needs to label its tags — just
 * enough to display, not the full SubjectType (stage_ids/grade_ids are
 * irrelevant here). See MeetingClassroomType for the same idea.
 */
#[TypeScript]
final class LibraryResourceSubjectType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name_en,
        public readonly string $name_ar,
    ) {}

    public static function fromModel(Subject $subject): self
    {
        return new self(
            id: $subject->id,
            name_en: $subject->getTranslation('name', 'en'),
            name_ar: $subject->getTranslation('name', 'ar'),
        );
    }
}
