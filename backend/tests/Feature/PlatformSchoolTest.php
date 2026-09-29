<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\SchoolStatus;
use App\Models\School;
use App\Models\Setting;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;

/**
 * Step 8 of docs/multi-tenancy.md: a platform admin creates and suspends
 * schools.
 */
class PlatformSchoolTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private School $defaultSchool;

    private User $platformAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->defaultSchool = School::query()->oldest('id')->firstOrFail();

        $this->platformAdmin = $this->adminAt($this->defaultSchool);
        $this->platformAdmin->forceFill(['is_platform_admin' => true])->save();
    }

    public function test_only_platform_admins_reach_platform_routes(): void
    {
        $schoolAdmin = $this->adminAt($this->defaultSchool);

        $this->withToken($this->loginToken($schoolAdmin))->getJson('/api/platform/schools')->assertForbidden();
        $this->as($this->platformAdmin)->getJson('/api/platform/schools')
            ->assertOk()
            ->assertJsonPath('schools.0.slug', $this->defaultSchool->slug);
    }

    public function test_a_platform_admins_school_token_does_not_reach_platform_routes(): void
    {
        // The same account, signed in as the school's admin instead of
        // through the system admin login.
        $this->withToken($this->loginToken($this->platformAdmin))->getJson('/api/platform/schools')->assertForbidden();
    }

    public function test_creating_a_school_with_a_new_email_invites_its_first_admin(): void
    {
        Notification::fake();

        $response = $this->createSchool(['admin_email' => 'head@new.school'])
            ->assertCreated()
            ->assertJsonPath('admin_invited', true)
            ->assertJsonPath('school.members_count', 1);

        $school = School::findOrFail($response->json('school.id'));
        $admin = User::where('email', 'head@new.school')->sole();

        $this->assertSame(MembershipRole::Admin, $admin->memberships()->sole()->role);
        $this->assertSame($school->id, $admin->memberships()->sole()->school_id);
        $this->assertTrue(app(TenantContext::class)->runAs($school, fn () => $admin->unsetRelation('roles')->hasRole('admin')));
        $this->assertSame('New School', app(TenantContext::class)->runAs($school, fn () => Setting::where('key', 'school_name')->value('value')));
        Notification::assertSentTo($admin, ResetPassword::class);
    }

    public function test_creating_a_school_with_an_existing_email_adds_a_membership(): void
    {
        Notification::fake();
        $existing = $this->adminAt($this->defaultSchool);

        $this->createSchool(['admin_email' => $existing->email])
            ->assertCreated()
            ->assertJsonPath('admin_invited', false);

        $this->assertSame(1, User::where('email', $existing->email)->count());
        $this->assertSame(2, $existing->memberships()->count());
        Notification::assertNothingSent();
    }

    public function test_slug_must_be_unique_and_url_safe(): void
    {
        $this->createSchool(['slug' => $this->defaultSchool->slug])->assertJsonValidationErrors('slug');
        $this->createSchool(['slug' => 'Not A Slug'])->assertJsonValidationErrors('slug');
    }

    public function test_suspending_a_school_signs_its_members_out(): void
    {
        Notification::fake();
        $schoolId = $this->createSchool()->json('school.id');
        $member = $this->adminAt(School::findOrFail($schoolId));
        $token = $this->loginToken($member, $schoolId);

        $this->as($this->platformAdmin)->postJson("/api/platform/schools/{$schoolId}/status", ['status' => 'suspended', 'reason' => 'Unpaid invoice'])
            ->assertOk()->assertJsonPath('school.status', 'suspended');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
    }

    public function test_suspending_a_school_the_system_admin_belongs_to_keeps_their_platform_session(): void
    {
        $token = $this->systemAdminToken($this->platformAdmin);

        $this->withToken($token)
            ->postJson("/api/platform/schools/{$this->defaultSchool->id}/status", ['status' => 'suspended', 'reason' => 'Maintenance'])
            ->assertOk();

        $this->assertSame(SchoolStatus::Suspended, $this->defaultSchool->fresh()->status);
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/platform/schools')->assertOk();
    }

    private function createSchool(array $overrides = []): TestResponse
    {
        return $this->as($this->platformAdmin)->postJson('/api/platform/schools', [
            'name' => 'New School',
            'slug' => 'new-school',
            'admin_name' => 'Head Teacher',
            'admin_email' => 'head@new.school',
            ...$overrides,
        ]);
    }

    private function adminAt(School $school): User
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($school, fn () => app(MembershipService::class)->grant($user, MembershipRole::Admin));

        return $user;
    }

    /** Signed in through the system admin login (password + two-factor). */
    private function as(User $user): self
    {
        $token = $this->systemAdminToken($user);
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }

    private function loginToken(User $user, ?int $schoolId = null): string
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', array_filter([
            'email' => $user->email,
            'password' => 'password',
            'role' => 'admin',
            'school_id' => $schoolId,
        ]))->assertOk()->json('token');
    }
}
