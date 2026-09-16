<?php

namespace App\TypeScript;

use App\Enums\TeacherStatus;
use App\Models\Teacher;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class TeacherType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $email,
        public readonly ?string $phone,
        public readonly string $joining_date,
        public readonly TeacherStatus $status,
        /** @var int[] */
        public readonly array $subject_ids,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Teacher $teacher): self
    {
        return new self(
            id: $teacher->id,
            name: $teacher->name,
            email: $teacher->email,
            phone: $teacher->phone,
            joining_date: $teacher->joining_date->toDateString(),
            status: $teacher->status,
            subject_ids: $teacher->subjects->pluck('id')->all(),
            created_at: $teacher->created_at->toJSON(),
            updated_at: $teacher->updated_at->toJSON(),
        );
    }
}
