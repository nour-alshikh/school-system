<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\School;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\Subject;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 4 of docs/self-service-schools-plan.md: a new school's setup
 * checklist and its "Create a standard structure" quick start.
 */
class OnboardingTest extends TestCase
{
    use RefreshDatabase;

    private School $defaultSchool;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->defaultSchool = School::query()->oldest('id')->firstOrFail();
    }

    public function test_a_new_school_starts_with_every_step_to_do(): void
    {
        $response = $this->withToken($this->newSchoolToken())->getJson('/api/admin/onboarding')
            ->assertOk()
            ->assertJsonPath('onboarding.dismissed', false);

        $steps = collect($response->json('onboarding.steps'));
        $this->assertSame(
            ['branding', 'academic_year', 'stages', 'grades', 'classrooms', 'subjects', 'teachers', 'students'],
            $steps->pluck('key')->all(),
        );
        $this->assertFalse($steps->contains('done', true));
    }

    public function test_steps_follow_what_the_school_has(): void
    {
        $token = $this->newSchoolToken();
        $school = School::where('slug', 'green-valley')->sole();

        app(TenantContext::class)->runAs($school, function () {
            Setting::where('key', 'primary_color')->update(['value' => '#0f766e']);
            Stage::create(['name' => ['en' => 'Primary', 'ar' => 'ابتدائي']]);
        });

        $steps = collect($this->withToken($token)->getJson('/api/admin/onboarding')->json('onboarding.steps'))->keyBy('key');

        $this->assertTrue($steps['branding']['done']);
        $this->assertTrue($steps['stages']['done']);
        $this->assertSame(1, $steps['stages']['count']);
        $this->assertFalse($steps['grades']['done']);
    }

    public function test_the_standard_structure_fills_an_empty_school(): void
    {
        $token = $this->newSchoolToken();
        $school = School::where('slug', 'green-valley')->sole();

        $steps = collect(
            $this->withToken($token)->postJson('/api/admin/onboarding/standard-structure')
                ->assertCreated()
                ->json('onboarding.steps')
        )->keyBy('key');

        foreach (['academic_year', 'stages', 'grades', 'classrooms', 'subjects'] as $key) {
            $this->assertTrue($steps[$key]['done'], $key);
        }
        $this->assertFalse($steps['teachers']['done']);

        app(TenantContext::class)->runAs($school, function () {
            $this->assertSame(3, Stage::count());
            $this->assertSame(12, Grade::count());
            // One classroom per grade (the seeders make three).
            $this->assertSame(12, Classroom::count());
            $this->assertSame(10, Subject::count());
            $this->assertSame(now()->year, AcademicYear::where('is_current', true)->value('year'));
        });

        // Nothing leaked into the other school.
        $this->assertSame(0, app(TenantContext::class)->runAs($this->defaultSchool, fn () => Stage::count()));
    }

    public function test_the_standard_structure_is_refused_once_the_school_has_stages(): void
    {
        $token = $this->newSchoolToken();
        $this->withToken($token)->postJson('/api/admin/onboarding/standard-structure')->assertCreated();

        $this->withToken($token)->postJson('/api/admin/onboarding/standard-structure')
            ->assertJsonValidationErrors('structure');

        $this->assertSame(3, app(TenantContext::class)->runAs(School::where('slug', 'green-valley')->sole(), fn () => Stage::count()));
    }

    public function test_dismissing_hides_the_checklist(): void
    {
        $token = $this->newSchoolToken();

        $this->withToken($token)->postJson('/api/admin/onboarding/dismiss')
            ->assertOk()
            ->assertJsonPath('onboarding.dismissed', true);

        $this->withToken($token)->getJson('/api/admin/onboarding')->assertJsonPath('onboarding.dismissed', true);
    }

    public function test_dismissing_works_for_a_school_created_before_the_setting_existed(): void
    {
        $token = $this->newSchoolToken();
        app(TenantContext::class)->runAs(
            School::where('slug', 'green-valley')->sole(),
            fn () => Setting::where('key', 'onboarding_dismissed_at')->delete(),
        );

        $this->withToken($token)->postJson('/api/admin/onboarding/dismiss')->assertJsonPath('onboarding.dismissed', true);
    }

    public function test_only_admins_see_the_checklist(): void
    {
        $this->getJson('/api/admin/onboarding')->assertUnauthorized();

        $plain = $this->postJson('/api/register', [
            'name' => 'Plain', 'email' => 'plain@example.com', 'password' => 'password', 'password_confirmation' => 'password',
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($plain)->getJson('/api/admin/onboarding')->assertForbidden();
        $this->withToken($plain)->postJson('/api/admin/onboarding/standard-structure')->assertForbidden();
    }

    /** Signed up the real way, so the token is admin of a fresh, empty school. */
    private function newSchoolToken(): string
    {
        return $this->postJson('/api/school-signup', [
            'name' => 'Owner',
            'email' => 'owner@green.school',
            'password' => 'password',
            'password_confirmation' => 'password',
            'school_name' => 'Green Valley',
            'slug' => 'green-valley',
        ])->assertCreated()->json('token');
    }
}
