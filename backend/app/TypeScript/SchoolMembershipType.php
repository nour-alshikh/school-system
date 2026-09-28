<?php

namespace App\TypeScript;

use App\Models\SchoolMembership;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One school a user can act in, and as what — drives the school picker at
 * login and the school switcher in the user menu.
 */
#[TypeScript]
final class SchoolMembershipType
{
    public function __construct(
        public readonly int $id,
        public readonly string $role,
        public readonly int $school_id,
        public readonly string $school_name,
    ) {}

    public static function fromModel(SchoolMembership $membership): self
    {
        return new self(
            id: $membership->id,
            role: $membership->role->value,
            school_id: $membership->school_id,
            school_name: $membership->school->name,
        );
    }
}
