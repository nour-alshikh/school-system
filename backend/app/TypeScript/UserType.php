<?php

namespace App\TypeScript;

use App\Models\PlatformSession;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Services\Ai\AiAccess;
use App\Services\MembershipService;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class UserType
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $email,
        public readonly ?string $email_verified_at,
        public readonly string $created_at,
        public readonly string $updated_at,
        /** @var string[] */
        public readonly array $roles,
        /** @var string[] */
        public readonly array $permissions,
        public readonly ?string $avatar_url,
        /** Can create and suspend schools (Platform → Schools). Not a school role. */
        public readonly bool $is_platform_admin,
        /** The school + role this session is signed in as; null for a plain account. */
        public readonly ?SchoolMembershipType $current_membership,
        /**
         * Every school + role this account can switch to.
         *
         * @var SchoolMembershipType[]
         */
        public readonly array $memberships,
        /** Set while a system admin is inside a school as its admin (central dashboard, phase 5). */
        public readonly ?ActingAsType $acting_as = null,
        /**
         * Modules the current school's plan includes (fees, exams, meetings,
         * library, ai); null with no current school.
         *
         * @var string[]|null
         */
        public readonly ?array $plan_features = null,
        /**
         * Whether "Draft with AI" works at the current school: a key is set,
         * the plan includes ai and the school hasn't turned it off (AiAccess).
         */
        public readonly bool $ai_available = false,
        /**
         * Whether AI may also use the school's records (the assistant_data
         * setting, AiAccess::readsData): progress notes, the weekly summary.
         */
        public readonly bool $ai_reads_data = false,
        /** Whether a system admin needs a two-factor code to open a school (config platform.two_factor). */
        public readonly bool $platform_two_factor = true,
    ) {}

    public static function fromModel(User $user, ?SchoolMembership $current = null, ?PlatformSession $session = null): self
    {
        return new self(
            id: $user->id,
            name: $user->name,
            email: $user->email,
            email_verified_at: $user->email_verified_at?->toJSON(),
            created_at: $user->created_at->toJSON(),
            updated_at: $user->updated_at->toJSON(),
            roles: $user->getRoleNames()->all(),
            permissions: $user->getAllPermissions()->pluck('name')->all(),
            avatar_url: $user->getFirstMediaUrl('avatar', 'thumb') ?: null,
            is_platform_admin: (bool) $user->is_platform_admin,
            current_membership: $current ? SchoolMembershipType::fromModel($current) : null,
            memberships: app(MembershipService::class)->usable($user)
                ->map(fn (SchoolMembership $m) => SchoolMembershipType::fromModel($m))
                ->all(),
            acting_as: $session ? ActingAsType::fromSession($session) : null,
            plan_features: ($current?->school ?? $session?->school)?->effectivePlan()->features,
            ai_available: app(AiAccess::class)->available($current?->school ?? $session?->school),
            ai_reads_data: ($school = $current?->school ?? $session?->school) !== null && app(AiAccess::class)->readsData($school),
            platform_two_factor: (bool) config('platform.two_factor'),
        );
    }
}
