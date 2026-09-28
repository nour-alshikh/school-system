<?php

namespace Tests\Feature\Auth;

use App\Enums\MembershipRole;
use App\Models\School;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    public function test_user_can_log_in_through_their_own_roles_form(): void
    {
        $user = User::factory()->create();
        $this->grantTeacher($user);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'role' => 'teacher',
        ]);

        $response->assertOk();
        $response->assertJsonPath('user.email', $user->email);
    }

    public function test_user_cannot_log_in_through_a_different_roles_form(): void
    {
        $user = User::factory()->create();
        $this->grantTeacher($user);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'role' => 'admin',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('email');
    }

    public function test_role_must_be_one_of_the_known_login_forms(): void
    {
        $user = User::factory()->create();
        $this->grantTeacher($user);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password',
            'role' => 'superadmin',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors('role');
    }

    private function grantTeacher(User $user): void
    {
        app(TenantContext::class)->runAs(School::firstOrFail(), fn () => app(MembershipService::class)->grant($user, MembershipRole::Teacher));
    }
}
