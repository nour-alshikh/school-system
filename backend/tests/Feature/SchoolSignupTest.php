<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\SchoolSource;
use App\Models\School;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\User;
use App\Services\MembershipService;
use App\Services\SchoolProvisioner;
use App\Services\SchoolSignupService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use RuntimeException;
use Tests\TestCase;

/**
 * Phase 1 of docs/self-service-schools-plan.md: anyone can create a school
 * and is its admin right away.
 */
class SchoolSignupTest extends TestCase
{
    use RefreshDatabase;

    private School $defaultSchool;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->defaultSchool = School::query()->oldest('id')->firstOrFail();
    }

    public function test_a_guest_signs_up_and_is_admin_of_the_new_school(): void
    {
        Notification::fake();

        $response = $this->signUp()
            ->assertCreated()
            ->assertJsonPath('user.email', 'owner@green.school')
            ->assertJsonPath('user.roles', ['admin']);

        $user = User::where('email', 'owner@green.school')->sole();
        $school = School::where('slug', 'green-valley')->sole();

        $this->assertSame(SchoolSource::SelfService, $school->source);
        $this->assertSame($user->id, $school->created_by_id);
        $this->assertSame(MembershipRole::Admin, $user->memberships()->sole()->role);
        $this->assertSame($school->id, $user->memberships()->sole()->school_id);
        $this->assertSame('Green Valley', $this->setting($school, 'school_name'));
        $this->assertSame('owner@green.school', $this->setting($school, 'email'));
        // They chose their own password: no invitation.
        Notification::assertNothingSent();

        // The token acts as admin of the new school and nowhere else.
        $token = $response->json('token');
        $this->withToken($token)->getJson('/api/stages')->assertOk()->assertJsonCount(0, 'stages');
        $this->withToken($token)->getJson('/api/user')->assertJsonPath('user.current_membership.school_id', $school->id);
    }

    public function test_the_new_school_sees_none_of_another_schools_data(): void
    {
        app(TenantContext::class)->runAs($this->defaultSchool, fn () => Stage::create(['name' => ['en' => 'Theirs', 'ar' => 'Theirs']]));

        $token = $this->signUp()->assertCreated()->json('token');

        $this->withToken($token)->getJson('/api/stages')->assertOk()->assertJsonCount(0, 'stages');
    }

    public function test_a_signed_in_user_adds_a_school_and_the_session_moves_to_it(): void
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($this->defaultSchool, fn () => app(MembershipService::class)->grant($user, MembershipRole::Teacher));
        $oldToken = $this->loginToken($user, 'teacher');

        $this->app['auth']->forgetGuards();
        $response = $this->withToken($oldToken)->postJson('/api/schools', [
            'school_name' => 'Hilltop',
            'slug' => 'hilltop',
        ])->assertCreated()->assertJsonPath('user.roles', ['admin']);

        $school = School::where('slug', 'hilltop')->sole();
        $this->assertSame($user->id, $school->created_by_id);
        $this->assertSame(2, $user->memberships()->count());

        $this->app['auth']->forgetGuards();
        $this->flushHeaders()->withToken($oldToken)->getJson('/api/user')->assertUnauthorized();

        $this->app['auth']->forgetGuards();
        $this->flushHeaders()->withToken($response->json('token'))->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('user.current_membership.school_id', $school->id);
    }

    public function test_a_plain_account_can_add_its_first_school(): void
    {
        $token = $this->postJson('/api/register', [
            'name' => 'Plain',
            'email' => 'plain@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])->assertOk()->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/schools', ['school_name' => 'First', 'slug' => 'first-school'])
            ->assertCreated()
            ->assertJsonPath('user.roles', ['admin']);
    }

    public function test_creating_a_school_needs_a_signed_in_user(): void
    {
        $this->postJson('/api/schools', ['school_name' => 'X', 'slug' => 'x-school'])->assertUnauthorized();
    }

    public function test_slugs_must_be_valid_free_and_not_reserved(): void
    {
        $this->signUp(['slug' => $this->defaultSchool->slug])->assertJsonValidationErrors('slug');
        $this->signUp(['slug' => 'platform'])->assertJsonValidationErrors('slug');
        $this->signUp(['slug' => 'Not A Slug'])->assertJsonValidationErrors('slug');
        $this->signUp(['slug' => 'ab'])->assertJsonValidationErrors('slug');

        $this->assertSame(1, School::count());
    }

    public function test_the_slug_check_says_why_a_slug_is_unavailable(): void
    {
        $this->getJson('/api/school-slugs/green-valley')->assertExactJson(['available' => true]);
        $this->getJson("/api/school-slugs/{$this->defaultSchool->slug}")->assertExactJson(['available' => false, 'reason' => 'taken']);
        $this->getJson('/api/school-slugs/admin')->assertExactJson(['available' => false, 'reason' => 'reserved']);
        $this->getJson('/api/school-slugs/Bad_Slug')->assertExactJson(['available' => false, 'reason' => 'invalid']);
    }

    public function test_an_existing_email_cannot_sign_up_again(): void
    {
        $existing = User::factory()->create();

        $this->signUp(['email' => $existing->email])->assertJsonValidationErrors('email');
        $this->assertSame(1, School::count());
    }

    public function test_a_failed_school_leaves_no_account_behind(): void
    {
        $this->mock(SchoolProvisioner::class)
            ->shouldReceive('createForOwner')
            ->andThrow(new RuntimeException('boom'));

        $this->withoutExceptionHandling();

        try {
            $this->signUp();
            $this->fail('Expected the signup to fail.');
        } catch (RuntimeException) {
        }

        $this->assertNull(User::where('email', 'owner@green.school')->first());
    }

    public function test_signups_are_throttled_per_address(): void
    {
        foreach (['one', 'two', 'three'] as $n) {
            $this->signUp(['email' => "{$n}@x.school", 'slug' => "school-{$n}"])->assertCreated();
            $this->app['auth']->forgetGuards();
        }

        $this->signUp(['email' => 'four@x.school', 'slug' => 'school-four'])->assertTooManyRequests();
    }

    public function test_rejected_signups_do_not_use_up_the_limit(): void
    {
        foreach (range(1, 5) as $n) {
            $this->signUp(['slug' => 'admin'])->assertJsonValidationErrors('slug');
        }

        $this->signUp()->assertCreated();
    }

    public function test_schools_made_by_a_platform_admin_are_marked_as_such(): void
    {
        Notification::fake();

        ['school' => $school] = app(SchoolProvisioner::class)->create('Via Platform', 'via-platform', 'Head', 'head@via.school');

        $this->assertSame(SchoolSource::Platform, $school->fresh()->source);
        $this->assertNull($school->created_by_id);
    }

    public function test_a_filled_honeypot_creates_nothing_and_reveals_nothing(): void
    {
        $existing = User::factory()->create();

        // Even with an email that's taken, the answer doesn't say so.
        $this->signUp(['website' => 'https://spam.example', 'email' => $existing->email])
            ->assertUnprocessable()
            ->assertJsonMissingPath('errors');

        $this->signUp(['website' => 'https://spam.example'])->assertUnprocessable();

        $this->assertSame(1, School::count());
        $this->assertNull(User::where('email', 'owner@green.school')->first());
    }

    public function test_one_account_can_create_only_so_many_schools(): void
    {
        config(['schools.max_self_service_per_user' => 2]);
        $token = $this->signUp()->assertCreated()->json('token');

        $this->app['auth']->forgetGuards();
        $token = $this->withToken($token)->postJson('/api/schools', ['school_name' => 'Second', 'slug' => 'second-school'])
            ->assertCreated()->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/schools', ['school_name' => 'Third', 'slug' => 'third-school'])
            ->assertJsonValidationErrors('school_name');

        $this->assertSame(3, School::count());
    }

    public function test_platform_admins_are_not_limited(): void
    {
        config(['schools.max_self_service_per_user' => 0]);
        $admin = User::factory()->create(['is_platform_admin' => true]);

        $this->assertSame('limitless', app(SchoolSignupService::class)->addSchool($admin, 'Limitless', 'limitless')['membership']->school->slug);
    }

    private function signUp(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/school-signup', [
            'name' => 'Owner',
            'email' => 'owner@green.school',
            'password' => 'password',
            'password_confirmation' => 'password',
            'school_name' => 'Green Valley',
            'slug' => 'green-valley',
            ...$overrides,
        ]);
    }

    private function setting(School $school, string $key): ?string
    {
        return app(TenantContext::class)->runAs($school, fn () => Setting::where('key', $key)->value('value'));
    }

    private function loginToken(User $user, string $role): string
    {
        return $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'role' => $role,
        ])->assertOk()->json('token');
    }
}
