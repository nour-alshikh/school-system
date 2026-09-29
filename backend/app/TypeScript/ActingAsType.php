<?php

namespace App\TypeScript;

use App\Models\PlatformSession;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * A system admin working inside a school as its admin: what the banner
 * shows (docs/central-dashboard-plan.md, phase 5).
 */
#[TypeScript]
final class ActingAsType
{
    public function __construct(
        public readonly string $type,
        public readonly int $session_id,
        public readonly int $school_id,
        public readonly string $school_name,
        public readonly string $expires_at,
    ) {}

    public static function fromSession(PlatformSession $session): self
    {
        return new self(
            type: 'system_admin',
            session_id: $session->id,
            school_id: $session->school_id,
            school_name: $session->school->name,
            expires_at: $session->expires_at->toJSON(),
        );
    }
}
