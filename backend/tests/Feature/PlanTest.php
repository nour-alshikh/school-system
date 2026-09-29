<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\Plan;
use App\Models\School;
use App\Models\Setting;
use App\Models\User;
use App\Platform\PlanLimits;
use App\Services\MembershipService;
use App\Services\SchoolProvisioner;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;

/**
 * Phase 9 of docs/central-dashboard-plan.md: plans and their limits,
 * enforced server side.
 */
class PlanTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
    }

    public function test_existing_schools_are_on_unlimited_and_self_service_ones_on_basic(): void
    {
        $this->assertSame('unlimited', $this->school->plan->key);

        $this->postJson('/api/school-signup', [
            'name' => 'Owner', 'email' => 'owner@x.test', 'password' => 'password', 'password_confirmation' => 'password',
            'school_name' => 'Small School', 'slug' => 'small-school',
        ])->assertCreated()->assertJsonPath('user.plan_features', ['fees', 'exams', 'library']);

        $this->assertSame('basic', School::where('slug', 'small-school')->sole()->plan->key);
    }

    public function test_a_module_outside_the_plan_is_refused(): void
    {
        $this->onPlan('basic');
        $admin = $this->token(MembershipRole::Admin);

        $this->as($admin)->getJson('/api/meetings')
            ->assertForbidden()
            ->assertJsonPath('message', 'Not included in your plan.');
        $this->as($admin)->getJson('/api/exams')->assertOk();
        $this->as($admin)->getJson('/api/user')->assertJsonPath('user.plan_features', ['fees', 'exams', 'library']);
    }

    public function test_a_system_admin_inside_the_school_is_not_limited(): void
    {
        $this->onPlan('basic');
        $systemAdmin = User::factory()->create(['is_platform_admin' => true]);
        $platform = $this->systemAdminToken($systemAdmin);
        $google2fa = app(Google2FA::class);
        $this->as($platform)->postJson('/api/platform/confirm', [
            'code' => $google2fa->oathTotp($systemAdmin->fresh()->two_factor_secret, $google2fa->getTimestamp() + 1),
        ])->assertNoContent();
        $session = $this->as($platform)->postJson("/api/platform/schools/{$this->school->id}/enter")->json('token');

        $this->as($session)->getJson('/api/meetings')->assertOk();
    }

    public function test_student_registration_stops_at_the_limit(): void
    {
        $this->onPlan('basic');
        Plan::where('key', 'basic')->update(['max_students' => 0]);

        $this->expectException(ValidationException::class);
        app(TenantContext::class)->runAs($this->school->fresh(), fn () => app(PlanLimits::class)->ensureRoomForStudent());
    }

    public function test_uploads_stop_at_the_storage_limit(): void
    {
        $this->onPlan('basic');
        Plan::where('key', 'basic')->update(['max_storage_mb' => 1]);

        app(TenantContext::class)->runAs($this->school->fresh(), function () {
            app(SchoolProvisioner::class)->seedDefaultSettings();
            $logo = Setting::where('key', 'logo')->firstOrFail();

            $logo->addMediaFromString(str_repeat('x', 500 * 1024))->usingFileName('small.png')->toMediaCollection('file');

            try {
                Setting::where('key', 'favicon')->firstOrFail()
                    ->addMediaFromString(str_repeat('x', 700 * 1024))->usingFileName('big.png')->toMediaCollection('file');
                $this->fail('Expected the upload to be refused.');
            } catch (ValidationException $e) {
                $this->assertStringContainsString('1 MB', $e->getMessage());
            }
        });

        $this->assertSame(1, DB::table('media')->where('school_id', $this->school->id)->count());
    }

    public function test_the_system_admin_edits_plans_and_moves_schools(): void
    {
        $platform = $this->systemAdminToken(User::factory()->create(['is_platform_admin' => true]));
        $basic = Plan::where('key', 'basic')->sole();

        $this->as($platform)->getJson('/api/platform/plans')->assertOk()->assertJsonCount(3, 'plans');
        $this->as($platform)->putJson("/api/platform/plans/{$basic->id}", ['name' => 'Basic', 'max_students' => 150, 'max_storage_mb' => 2048, 'features' => ['fees', 'library']])
            ->assertOk()
            ->assertJsonPath('plan.max_students', 150);
        $this->as($platform)->putJson("/api/platform/schools/{$this->school->id}/plan", ['plan_id' => $basic->id])
            ->assertOk()
            ->assertJsonPath('plan.key', 'basic');

        $this->assertDatabaseHas('audit_logs', ['action' => 'plan.updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.plan_changed', 'school_id' => $this->school->id]);
        $this->as($platform)->getJson('/api/platform/overview?refresh=1')->assertJsonPath('schools.0.plan.key', 'basic');
    }

    public function test_school_tokens_cannot_manage_plans(): void
    {
        $this->as($this->token(MembershipRole::Admin))->getJson('/api/platform/plans')->assertForbidden();
    }

    private function onPlan(string $key): void
    {
        $this->school->update(['plan_id' => Plan::where('key', $key)->value('id')]);
    }

    private function token(MembershipRole $role): string
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($this->school, fn () => app(MembershipService::class)->grant($user, $role));
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', ['email' => $user->email, 'password' => 'password', 'role' => $role->value])->json('token');
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }
}
