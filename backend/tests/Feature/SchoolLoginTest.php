<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Models\PersonalAccessToken;
use App\Models\School;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Step 5 of docs/multi-tenancy.md: the school a request acts as comes from
 * the membership its token was issued for — chosen at login, changed only
 * through /switch-school.
 */
class SchoolLoginTest extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;

    private School $schoolB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->schoolA = School::query()->oldest('id')->firstOrFail();
        $this->schoolB = School::create(['name' => 'Second School', 'slug' => 'second-school']);

        $this->inSchool($this->schoolA, fn () => $this->makeStage('Only In A'));
        $this->inSchool($this->schoolB, fn () => $this->makeStage('Only In B'));
    }

    public function test_single_school_login_binds_the_token_to_that_membership(): void
    {
        $user = $this->userWith([[$this->schoolB, MembershipRole::Admin]]);

        $response = $this->login($user, 'admin')->assertOk();

        $response->assertJsonPath('user.current_membership.school_id', $this->schoolB->id);
        $this->assertSame(
            $user->memberships()->sole()->id,
            PersonalAccessToken::sole()->school_membership_id,
        );

        $this->withToken($response->json('token'))->getJson('/api/stages')
            ->assertOk()->assertSee('Only In B')->assertDontSee('Only In A');
    }

    public function test_same_role_at_two_schools_asks_which_school(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin], [$this->schoolB, MembershipRole::Admin]]);

        $this->login($user, 'admin')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('school_id')
            ->assertJsonCount(2, 'schools')
            ->assertJsonMissingPath('token');

        $this->assertSame(0, PersonalAccessToken::count());

        $this->login($user, 'admin', $this->schoolB->id)
            ->assertOk()
            ->assertJsonPath('user.current_membership.school_id', $this->schoolB->id);
    }

    public function test_role_at_one_school_only_signs_into_that_school(): void
    {
        // Teacher at A, parent at B: the teacher form can only mean A.
        $user = $this->userWith([[$this->schoolA, MembershipRole::Teacher], [$this->schoolB, MembershipRole::Parent]]);

        $this->login($user, 'teacher')->assertOk()
            ->assertJsonPath('user.current_membership.school_id', $this->schoolA->id)
            ->assertJsonCount(2, 'user.memberships');

        $this->login($user, 'teacher', $this->schoolB->id)->assertUnprocessable()->assertJsonValidationErrors('school_id');
    }

    public function test_role_without_a_usable_membership_cannot_log_in(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin]]);
        $user->memberships()->update(['status' => MembershipStatus::Left]);

        $this->login($user, 'admin')->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_switch_school_issues_a_new_token_and_revokes_the_old_one(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin], [$this->schoolB, MembershipRole::Admin]]);
        $oldToken = $this->login($user, 'admin', $this->schoolA->id)->json('token');
        $target = $user->memberships()->where('school_id', $this->schoolB->id)->sole();

        $response = $this->withToken($oldToken)->postJson('/api/switch-school', ['membership_id' => $target->id])
            ->assertOk()
            ->assertJsonPath('user.current_membership.school_id', $this->schoolB->id);

        $this->assertSame(1, PersonalAccessToken::count());
        $this->forgetAuth();

        $this->withToken($oldToken)->getJson('/api/user')->assertUnauthorized();
        $this->forgetAuth();

        $this->withToken($response->json('token'))->getJson('/api/stages')
            ->assertOk()->assertSee('Only In B')->assertDontSee('Only In A');
    }

    public function test_cannot_switch_to_someone_elses_membership(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin]]);
        $other = $this->userWith([[$this->schoolB, MembershipRole::Admin]]);
        $token = $this->login($user, 'admin')->json('token');

        $this->withToken($token)->postJson('/api/switch-school', ['membership_id' => $other->memberships()->sole()->id])
            ->assertForbidden();
    }

    public function test_revoked_membership_signs_the_token_out(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin]]);
        $token = $this->login($user, 'admin')->json('token');

        $user->memberships()->update(['status' => MembershipStatus::Suspended]);

        $this->withToken($token)->getJson('/api/stages')->assertUnauthorized();
    }

    public function test_school_hint_that_disagrees_with_the_token_is_rejected(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin]]);
        $token = $this->login($user, 'admin')->json('token');

        $this->withToken($token)->withHeader('X-School', $this->schoolB->slug)
            ->getJson('/api/stages')->assertForbidden();
    }

    public function test_plain_account_gets_403_on_school_data(): void
    {
        $token = $this->postJson('/api/register', [
            'name' => 'Plain', 'email' => 'plain@example.com',
            'password' => 'password123', 'password_confirmation' => 'password123',
        ])->assertOk()->assertJsonPath('user.current_membership', null)->json('token');

        $this->withToken($token)->getJson('/api/user')->assertOk();
        // Public branding still resolves (default school)...
        $this->withToken($token)->getJson('/api/settings')->assertOk();
        // ...but nothing school-owned behind auth does.
        $this->withToken($token)->getJson('/api/posts')->assertForbidden();
    }

    public function test_guest_school_hint_picks_the_branding_school(): void
    {
        $this->inSchool($this->schoolB, fn () => Setting::create(['key' => 'school_name', 'value' => 'B Academy', 'group' => 'general']));

        $this->withHeader('X-School', $this->schoolB->slug)->getJson('/api/settings')->assertOk()->assertSee('B Academy');
        $this->flushHeaders()->getJson('/api/settings')->assertOk()->assertDontSee('B Academy');
    }

    public function test_roles_and_permissions_follow_the_signed_in_school(): void
    {
        // Step 6: admin at A, parent at B — the admin powers stay at A.
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin], [$this->schoolB, MembershipRole::Parent]]);

        $asParent = $this->login($user, 'parent')->assertOk()
            ->assertJsonPath('user.roles', ['parent'])
            ->assertJsonPath('user.permissions', []);
        $this->forgetAuth();
        $this->withToken($asParent->json('token'))->getJson('/api/stages')->assertForbidden();
        $this->withToken($asParent->json('token'))->getJson('/api/admin/users')->assertForbidden();

        $asAdmin = $this->login($user, 'admin')->assertOk()->assertJsonPath('user.roles', ['admin']);
        $this->forgetAuth();
        $this->withToken($asAdmin->json('token'))->getJson('/api/stages')->assertOk()->assertSee('Only In A');
    }

    public function test_switching_school_switches_roles_in_the_response(): void
    {
        $user = $this->userWith([[$this->schoolA, MembershipRole::Admin], [$this->schoolB, MembershipRole::Parent]]);
        $token = $this->login($user, 'admin')->json('token');
        $parentMembership = $user->memberships()->where('school_id', $this->schoolB->id)->sole();

        $this->withToken($token)->postJson('/api/switch-school', ['membership_id' => $parentMembership->id])
            ->assertOk()
            ->assertJsonPath('user.roles', ['parent'])
            ->assertJsonPath('user.current_membership.role', 'parent');
    }

    public function test_admin_user_list_only_shows_this_schools_users(): void
    {
        $adminA = $this->userWith([[$this->schoolA, MembershipRole::Admin]]);
        $onlyInB = $this->userWith([[$this->schoolB, MembershipRole::Teacher]]);
        $token = $this->login($adminA, 'admin')->json('token');

        $this->withToken($token)->getJson('/api/admin/users')
            ->assertOk()
            ->assertSee($adminA->email)
            ->assertDontSee($onlyInB->email);
    }

    public function test_creating_a_teacher_login_grants_a_membership(): void
    {
        $user = User::factory()->create();

        $this->inSchool($this->schoolB, fn () => app(MembershipService::class)->grant($user, MembershipRole::Teacher));

        $this->assertSame($this->schoolB->id, $user->memberships()->sole()->school_id);
        $this->assertTrue($this->inSchool($this->schoolB, fn () => $user->unsetRelation('roles')->hasRole('teacher')));
        $this->assertFalse($this->inSchool($this->schoolA, fn () => $user->unsetRelation('roles')->hasRole('teacher')));
    }

    /** @param list<array{School, MembershipRole}> $memberships */
    private function userWith(array $memberships): User
    {
        $user = User::factory()->create();

        foreach ($memberships as [$school, $role]) {
            $this->inSchool($school, fn () => app(MembershipService::class)->grant($user, $role));
        }

        return $user;
    }

    private function login(User $user, string $role, ?int $schoolId = null): TestResponse
    {
        $this->forgetAuth();

        return $this->postJson('/api/login', array_filter([
            'email' => $user->email,
            'password' => 'password',
            'role' => $role,
            'school_id' => $schoolId,
        ]));
    }

    private function inSchool(School $school, callable $callback): mixed
    {
        return app(TenantContext::class)->runAs($school, $callback);
    }

    private function makeStage(string $name): Stage
    {
        return Stage::create(['name' => ['en' => $name, 'ar' => $name]]);
    }

    /** Sanctum caches the resolved user per app instance; tests reuse it across requests. */
    private function forgetAuth(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
