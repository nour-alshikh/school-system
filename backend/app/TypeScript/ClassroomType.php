<?php

namespace App\TypeScript;

use App\Models\Classroom;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class ClassroomType
{
    public function __construct(
        public readonly int $id,
        public readonly int $grade_id,
        public readonly string $name,
        public readonly ?int $capacity,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Classroom $classroom): self
    {
        return new self(
            id: $classroom->id,
            grade_id: $classroom->grade_id,
            name: $classroom->name,
            capacity: $classroom->capacity,
            created_at: $classroom->created_at->toJSON(),
            updated_at: $classroom->updated_at->toJSON(),
        );
    }
}
