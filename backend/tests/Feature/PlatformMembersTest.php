<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Models\School;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;

/**
 * Phase 6 of docs/central-dashboard-plan.md: a system admin manages a
 * school's admins and members.
 */
class PlatformMembersTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private School $school;

    private User $admin;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->admin = $this->member(MembershipRole::Admin);
        $this->token = $this->systemAdminToken(User::factory()->create(['is_platform_admin' => true]));
    }

    public function test_it_lists_the_schools_members_with_filters(): void
    {
        $this->member(MembershipRole::Teacher);
        $other = School::create(['name' => 'Other', 'slug' => 'other-school']);
        $this->member(MembershipRole::Teacher, $other);

        $this->platform()->getJson("/api/platform/schools/{$this->school->id}/members")
            ->assertOk()
            ->assertJsonCount(2, 'members')
            ->assertJsonPath('members.0.role', 'admin');
        $this->platform()->getJson("/api/platform/schools/{$this->school->id}/members?role=teacher")
            ->assertJsonCount(1, 'members');
    }

    public function test_a_new_email_becomes_an_invited_admin(): void
    {
        $this->platform()->postJson("/api/platform/schools/{$this->school->id}/admins", ['name' => 'New Head', 'email' => 'head@new.test'])
            ->assertCreated()
            ->assertJsonPath('invited', true);

        $user = User::where('email', 'head@new.test')->sole();
        $this->assertTrue($user->memberships()->where('school_id', $this->school->id)->where('role', 'admin')->exists());
        Notification::assertSentTo($user, ResetPassword::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.admin_added', 'school_id' => $this->school->id]);
    }

    public function test_an_existing_account_is_added_without_an_invitation(): void
    {
        $existing = User::factory()->create();

        $this->platform()->postJson("/api/platform/schools/{$this->school->id}/admins", ['name' => 'x', 'email' => $existing->email])
            ->assertCreated()
            ->assertJsonPath('invited', false);

        Notification::assertNothingSent();
    }

    public function test_the_last_admin_cannot_be_removed_or_suspended(): void
    {
        $this->platform()->deleteJson("/api/platform/schools/{$this->school->id}/admins/{$this->admin->id}")->assertJsonValidationErrors('admin');

        $membership = $this->admin->memberships()->sole();
        $this->platform()->patchJson("/api/platform/schools/{$this->school->id}/members/{$membership->id}", ['status' => 'suspended'])
            ->assertJsonValidationErrors('admin');

        $this->assertSame(MembershipStatus::Active, $membership->fresh()->status);
    }

    public function test_an_admin_can_be_removed_when_another_remains(): void
    {
        $this->member(MembershipRole::Admin);

        $this->platform()->deleteJson("/api/platform/schools/{$this->school->id}/admins/{$this->admin->id}")->assertNoContent();

        $this->assertSame(MembershipStatus::Left, $this->admin->memberships()->sole()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.admin_removed', 'subject_id' => $this->admin->id]);
    }

    public function test_a_suspended_member_is_signed_out_and_can_be_reactivated(): void
    {
        $teacher = $this->member(MembershipRole::Teacher);
        $teacherToken = $this->postJson('/api/login', ['email' => $teacher->email, 'password' => 'password', 'role' => 'teacher'])->json('token');
        $membership = $teacher->memberships()->sole();

        $this->platform()->patchJson("/api/platform/schools/{$this->school->id}/members/{$membership->id}", ['status' => 'suspended'])->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->flushHeaders()->withToken($teacherToken)->getJson('/api/user')->assertUnauthorized();

        $this->platform()->patchJson("/api/platform/schools/{$this->school->id}/members/{$membership->id}", ['status' => 'active'])->assertNoContent();
        $this->assertSame(MembershipStatus::Active, $membership->fresh()->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.member_suspended']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.member_reactivated']);
    }

    public function test_a_password_reset_email_can_be_sent(): void
    {
        $membership = $this->admin->memberships()->sole();

        $this->platform()->postJson("/api/platform/schools/{$this->school->id}/members/{$membership->id}/password-reset")->assertNoContent();

        Notification::assertSentTo($this->admin, ResetPassword::class);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.password_reset_sent']);
    }

    public function test_a_membership_from_another_school_is_not_found(): void
    {
        $other = School::create(['name' => 'Other', 'slug' => 'other-school']);
        $elsewhere = $this->member(MembershipRole::Teacher, $other)->memberships()->sole();

        $this->platform()->patchJson("/api/platform/schools/{$this->school->id}/members/{$elsewhere->id}", ['status' => 'suspended'])->assertNotFound();
    }

    private function member(MembershipRole $role, ?School $school = null): User
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($school ?? $this->school, fn () => app(MembershipService::class)->grant($user, $role));

        return $user;
    }

    private function platform(): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($this->token);
    }
}
