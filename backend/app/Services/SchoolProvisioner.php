<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Enums\SchoolSource;
use App\Enums\SettingGroup;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\Setting;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Creates a school ready to use: default settings and a first admin. See
 * docs/multi-tenancy.md (step 8).
 */
class SchoolProvisioner
{
    /** Every school starts with these settings rows (values null unless given). */
    public const DEFAULT_SETTINGS = [
        'school_name' => SettingGroup::General,
        'tagline' => SettingGroup::General,
        'logo' => SettingGroup::Branding,
        'favicon' => SettingGroup::Branding,
        'primary_color' => SettingGroup::Branding,
        'address' => SettingGroup::Contact,
        'phone' => SettingGroup::Contact,
        'email' => SettingGroup::Contact,
        'facebook_url' => SettingGroup::Social,
        'twitter_url' => SettingGroup::Social,
        'instagram_url' => SettingGroup::Social,
        'youtube_url' => SettingGroup::Social,
        'linkedin_url' => SettingGroup::Social,
        'meta_title' => SettingGroup::Seo,
        'meta_description' => SettingGroup::Seo,
        'og_image' => SettingGroup::Seo,
        // Set when the admin hides the setup checklist (OnboardingController).
        'onboarding_dismissed_at' => SettingGroup::General,
    ];

    public function __construct(
        private readonly TenantContext $context,
        private readonly MembershipService $memberships,
    ) {}

    /**
     * The first admin is the account with $adminEmail if one exists (users
     * are global — they just gain a membership), otherwise a new account
     * that gets a set-your-password email.
     *
     * @return array{school: School, admin: User, invited: bool}
     */
    public function create(string $name, string $slug, string $adminName, string $adminEmail): array
    {
        [$school, $admin, $invited] = DB::transaction(function () use ($name, $slug, $adminName, $adminEmail) {
            $admin = User::where('email', $adminEmail)->first();
            $invited = $admin === null;
            $admin ??= User::create([
                'name' => $adminName,
                'email' => $adminEmail,
                // Never used: the admin sets their own through the reset link.
                'password' => Hash::make(Str::random(64)),
            ]);

            ['school' => $school] = $this->provision(
                ['name' => $name, 'slug' => $slug, 'source' => SchoolSource::Platform],
                $admin,
            );

            return [$school, $admin, $invited];
        });

        if ($invited) {
            // Reuses the forgot-password flow as the invitation.
            Password::sendResetLink(['email' => $admin->email]);
        }

        return ['school' => $school, 'admin' => $admin, 'invited' => $invited];
    }

    /**
     * Self-service: $owner creates a school and becomes its first admin.
     * They already have a password, so no invitation goes out. See
     * docs/self-service-schools-plan.md.
     *
     * @return array{school: School, membership: SchoolMembership}
     */
    public function createForOwner(User $owner, string $name, string $slug): array
    {
        return DB::transaction(fn () => $this->provision(
            ['name' => $name, 'slug' => $slug, 'source' => SchoolSource::SelfService, 'created_by_id' => $owner->id],
            $owner,
            ['email' => $owner->email],
        ));
    }

    /**
     * The part every new school shares: the row, its default settings and
     * its first admin. Callers wrap it in a transaction.
     *
     * @param  array<string, mixed>  $attributes
     * @param  array<string, string|null>  $settings  beyond school_name
     * @return array{school: School, membership: SchoolMembership}
     */
    private function provision(array $attributes, User $admin, array $settings = []): array
    {
        $school = School::create($attributes);

        $membership = $this->context->runAs($school, function () use ($school, $admin, $settings) {
            $this->seedDefaultSettings(['school_name' => $school->name, ...$settings]);

            return $this->memberships->grant($admin, MembershipRole::Admin);
        });

        return ['school' => $school, 'membership' => $membership];
    }

    /**
     * For the current school. Existing rows are left alone.
     *
     * @param  array<string, string|null>  $values
     */
    public function seedDefaultSettings(array $values = []): void
    {
        foreach (self::DEFAULT_SETTINGS as $key => $group) {
            Setting::firstOrCreate(['key' => $key], ['value' => $values[$key] ?? null, 'group' => $group]);
        }
    }
}
