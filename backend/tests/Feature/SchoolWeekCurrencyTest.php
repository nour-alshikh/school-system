<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Setting;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Step 0 of docs/demo-seeder-plan.md: each school's admin chooses its
 * currency and school week.
 */
class SchoolWeekCurrencyTest extends TestCase
{
    use RefreshDatabase;

    private string $token;

    private School $school;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->token = $this->postJson('/api/school-signup', [
            'name' => 'Owner', 'email' => 'owner@green.school', 'password' => 'password',
            'password_confirmation' => 'password', 'school_name' => 'Green Valley', 'slug' => 'green-valley',
        ])->assertCreated()->json('token');
        $this->school = School::where('slug', 'green-valley')->sole();
    }

    public function test_a_new_school_has_neither_chosen_yet(): void
    {
        $this->inSchool(function () {
            $this->assertNull(Setting::currency());
            $this->assertNull(Setting::schoolDays());
        });
    }

    public function test_the_admin_chooses_both(): void
    {
        $this->save(['currency' => 'SAR', 'school_days' => '0,1,2,3,4'])->assertOk();

        $this->inSchool(function () {
            $this->assertSame('SAR', Setting::currency());
            $this->assertSame([0, 1, 2, 3, 4], Setting::schoolDays());
        });

        $steps = collect($this->withToken($this->token)->getJson('/api/admin/onboarding')->json('onboarding.steps'))->keyBy('key');
        $this->assertTrue($steps['school_week_currency']['done']);
    }

    public function test_the_checklist_step_needs_both(): void
    {
        $this->save(['currency' => 'SAR'])->assertOk();

        $steps = collect($this->withToken($this->token)->getJson('/api/admin/onboarding')->json('onboarding.steps'))->keyBy('key');
        $this->assertFalse($steps['school_week_currency']['done']);
    }

    public function test_an_unsupported_currency_is_refused(): void
    {
        $this->save(['currency' => 'XYZ'])->assertJsonValidationErrors('currency');
        $this->inSchool(fn () => $this->assertNull(Setting::currency()));
    }

    public function test_malformed_school_days_are_refused(): void
    {
        $this->save(['school_days' => '0,7'])->assertJsonValidationErrors('school_days');
        $this->save(['school_days' => '1,1,2'])->assertJsonValidationErrors('school_days');
        $this->save(['school_days' => 'mon,tue'])->assertJsonValidationErrors('school_days');
    }

    public function test_one_schools_choice_does_not_touch_another(): void
    {
        $this->save(['currency' => 'SAR'])->assertOk();

        $default = School::query()->oldest('id')->firstOrFail();
        $this->assertNull(app(TenantContext::class)->runAs($default, fn () => Setting::currency()));
    }

    /** @param  array<string, string>  $values */
    private function save(array $values): TestResponse
    {
        return $this->withToken($this->token)->putJson('/api/settings', [
            'settings' => collect($values)->map(fn ($value, $key) => ['key' => $key, 'value' => $value])->values()->all(),
        ]);
    }

    private function inSchool(callable $callback): mixed
    {
        return app(TenantContext::class)->runAs($this->school, $callback);
    }
}
