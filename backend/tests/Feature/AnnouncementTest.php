<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\School;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;

/**
 * Phase 8 of docs/central-dashboard-plan.md: announcements from the system
 * admin, by school and role.
 */
class AnnouncementTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private School $school;

    private School $other;

    private string $platformToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->other = School::create(['name' => 'Other', 'slug' => 'other-school']);
        $this->platformToken = $this->systemAdminToken(User::factory()->create(['is_platform_admin' => true]));
    }

    public function test_the_system_admin_creates_edits_and_ends_one(): void
    {
        $id = $this->create(['title' => ['en' => 'Maintenance', 'ar' => 'صيانة'], 'level' => 'warning'])
            ->assertCreated()
            ->assertJsonPath('announcement.active', true)
            ->json('announcement.id');

        $this->as($this->platformToken)->putJson("/api/platform/announcements/{$id}", [
            'title' => ['en' => 'Maintenance tonight', 'ar' => 'صيانة الليلة'], 'level' => 'warning',
        ])->assertOk()->assertJsonPath('announcement.title.en', 'Maintenance tonight');

        $this->as($this->platformToken)->postJson("/api/platform/announcements/{$id}/end")->assertOk()->assertJsonPath('announcement.active', false);

        foreach (['announcement.created', 'announcement.updated', 'announcement.ended'] as $action) {
            $this->assertDatabaseHas('audit_logs', ['action' => $action]);
        }
    }

    public function test_people_see_whats_for_their_school_and_role_in_their_language(): void
    {
        $this->create(['title' => ['en' => 'For everyone', 'ar' => 'للجميع']]);
        $this->create(['title' => ['en' => 'Teachers here', 'ar' => 'معلمون'], 'school_id' => $this->school->id, 'audience' => ['teacher']]);
        $this->create(['title' => ['en' => 'Other school', 'ar' => 'مدرسة أخرى'], 'school_id' => $this->other->id]);
        $this->create(['title' => ['en' => 'Parents only', 'ar' => 'أولياء'], 'audience' => ['parent']]);
        $this->create(['title' => ['en' => 'Next week', 'ar' => 'لاحقًا'], 'starts_at' => now()->addWeek()->toJSON()]);

        $teacher = $this->signIn(MembershipRole::Teacher);

        $this->as($teacher)->getJson('/api/announcements')
            ->assertOk()
            ->assertJsonCount(2, 'announcements');
        $titles = collect($this->as($teacher)->withHeader('Accept-Language', 'ar')->getJson('/api/announcements')->json('announcements'))->pluck('title');
        $this->assertEqualsCanonicalizing(['للجميع', 'معلمون'], $titles->all());
    }

    public function test_dismissed_ones_stay_hidden_but_critical_cannot_be_dismissed(): void
    {
        $info = $this->create(['title' => ['en' => 'FYI', 'ar' => 'للعلم']])->json('announcement.id');
        $critical = $this->create(['title' => ['en' => 'Outage', 'ar' => 'انقطاع'], 'level' => 'critical'])->json('announcement.id');
        $teacher = $this->signIn(MembershipRole::Teacher);

        $this->as($teacher)->postJson("/api/announcements/{$info}/dismiss")->assertNoContent();
        $this->as($teacher)->postJson("/api/announcements/{$critical}/dismiss")->assertUnprocessable();

        $this->as($teacher)->getJson('/api/announcements')
            ->assertJsonCount(1, 'announcements')
            ->assertJsonPath('announcements.0.id', $critical)
            ->assertJsonPath('announcements.0.dismissible', false);
    }

    public function test_only_platform_tokens_manage_announcements(): void
    {
        $admin = $this->signIn(MembershipRole::Admin);

        $this->as($admin)->postJson('/api/platform/announcements', ['title' => ['en' => 'x', 'ar' => 'x'], 'level' => 'info'])->assertForbidden();
    }

    public function test_it_validates(): void
    {
        $this->create(['title' => ['en' => 'Only English'], 'level' => 'loud', 'audience' => ['janitor']])
            ->assertJsonValidationErrors(['title.ar', 'level', 'audience.0']);
    }

    private function create(array $overrides): TestResponse
    {
        return $this->as($this->platformToken)->postJson('/api/platform/announcements', [
            'level' => 'info',
            ...$overrides,
        ]);
    }

    private function signIn(MembershipRole $role): string
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
