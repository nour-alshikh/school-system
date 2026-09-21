<?php

namespace App\TypeScript;

use App\Models\Classroom;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The classroom shape a meeting needs to show — just enough to label it in
 * a list, not the full ClassroomType (capacity, subject_teachers, etc. are
 * irrelevant here).
 */
#[TypeScript]
final class MeetingClassroomType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
    ) {}

    public static function fromModel(Classroom $classroom): self
    {
        return new self(
            id: $classroom->id,
            name: $classroom->name,
        );
    }
}
