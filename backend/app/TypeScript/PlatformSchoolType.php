<?php

namespace App\TypeScript;

use App\Models\School;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * A school as the platform admin sees it (Platform → Schools).
 */
#[TypeScript]
final class PlatformSchoolType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $slug,
        public readonly string $status,
        public readonly int $members_count,
        public readonly string $created_at,
    ) {}

    public static function fromModel(School $school): self
    {
        return new self(
            id: $school->id,
            name: $school->name,
            slug: $school->slug,
            status: $school->status->value,
            members_count: (int) ($school->members_count ?? $school->memberships()->count()),
            created_at: $school->created_at->toJSON(),
        );
    }
}
