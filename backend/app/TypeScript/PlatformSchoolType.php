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
        /** Why it's suspended or archived; its members see this at sign-in. */
        public readonly ?string $status_reason,
        public readonly ?string $archived_at,
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
            status_reason: $school->status_reason,
            archived_at: $school->archived_at?->toJSON(),
            members_count: (int) ($school->members_count ?? $school->memberships()->count()),
            created_at: $school->created_at->toJSON(),
        );
    }
}
