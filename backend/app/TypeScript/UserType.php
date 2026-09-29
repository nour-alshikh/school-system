<?php

namespace App\TypeScript;

use App\Models\PlatformSession;
use App\Models\SchoolMembership;
use App\Models\User;
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
         * library); null with no current school.
         *
         * @var string[]|null
         */
        public readonly ?array $plan_features = null,
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
        );
    }
}
