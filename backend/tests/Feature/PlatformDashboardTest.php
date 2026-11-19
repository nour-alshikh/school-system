<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AuditLog;
use App\Models\FeePayment;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\Student;
use App\Models\User;
use App\Tenancy\TenantContext;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;

/**
 * Phases 2–4 of docs/central-dashboard-plan.md: the audit log, activity
 * tracking, and the monitoring pages — checked against the demo seed.
 */
class PlatformDashboardTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    private User $systemAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();
        $this->seed(DatabaseSeeder::class);

        $this->systemAdmin = User::where('email', 'system@demo.school')->sole();
    }

    public function test_the_overview_counts_every_school(): void
    {
        $response = $this->platform()->getJson('/api/platform/overview?refresh=1')->assertOk();

        $rows = collect($response->json('schools'))->keyBy('slug');
        $this->assertCount(School::count(), $rows);

        foreach (School::all() as $school) {
            $row = $rows[$school->slug];
            $expected = app(TenantContext::class)->runAs($school, fn () => [
                'students' => Student::where('status', 'active')->count(),
                'teachers' => SchoolMembership::where('school_id', $school->id)->where('role', 'teacher')->where('status', 'active')->count(),
                'collected' => (float) FeePayment::where('paid_at', '>=', now()->startOfMonth()->toDateString())->sum('amount'),
            ]);

            $this->assertSame($expected['students'], $row['students'], $school->slug);
            $this->assertSame($expected['teachers'], $row['teachers'], $school->slug);
            $this->assertEqualsWithDelta($expected['collected'], (float) $row['collected_this_month'], 0.01, $school->slug);
        }

        $this->assertSame($rows->sum('students'), $response->json('totals.students'));
        // EGP and USD are never added together.
        $this->assertEqualsCanonicalizing(['EGP', 'USD'], collect($response->json('collected_this_month'))->pluck('currency')->all());
    }

    public function test_a_schools_detail_page(): void
    {
        $hilltop = School::where('slug', 'hilltop')->sole();

        $this->platform()->getJson("/api/platform/schools/{$hilltop->id}")
            ->assertOk()
            ->assertJsonPath('school.name', 'Hilltop School')
            ->assertJsonPath('school.currency', 'USD')
            ->assertJsonPath('finance.currency', 'USD')
            ->assertJsonCount(6, 'finance.collections_by_month')
            ->assertJsonPath('people.admin', 2)
            ->assertJsonCount(2, 'admins');
    }

    public function test_warnings_flag_a_school_without_an_admin(): void
    {
        $hilltop = School::where('slug', 'hilltop')->sole();
        SchoolMembership::where('school_id', $hilltop->id)->where('role', MembershipRole::Admin->value)->update(['status' => 'suspended']);

        $row = collect($this->platform()->getJson('/api/platform/overview?refresh=1')->json('schools'))->firstWhere('slug', 'hilltop');

        $this->assertContains('no_admin', $row['warnings']);
    }

    public function test_platform_actions_are_audited_and_listed(): void
    {
        $hilltop = School::where('slug', 'hilltop')->sole();

        $this->platform()->postJson("/api/platform/schools/{$hilltop->id}/status", ['status' => 'suspended', 'reason' => 'Unpaid invoice'])->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'platform.signed_in', 'actor_id' => $this->systemAdmin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.suspended', 'school_id' => $hilltop->id, 'actor_id' => $this->systemAdmin->id]);

        $this->platform()->getJson("/api/platform/audit-logs?school_id={$hilltop->id}")
            ->assertOk()
            ->assertJsonCount(3, 'audit_logs') // the seed's two (created, plan changed), then this
            ->assertJsonPath('audit_logs.0.action', 'school.suspended')
            ->assertJsonPath('audit_logs.0.actor.email', 'system@demo.school');

        $this->platform()->getJson("/api/platform/schools/{$hilltop->id}")->assertJsonPath('audit.0.action', 'school.suspended');
    }

    public function test_logins_and_activity_are_tracked(): void
    {
        $teacher = User::where('email', 'mona.ali@teachers.demo')->sole();
        $this->assertNull($teacher->last_login_at);

        $token = $this->postJson('/api/login', ['email' => $teacher->email, 'password' => 'password', 'role' => 'teacher'])->assertOk()->json('token');
        $this->assertNotNull($teacher->fresh()->last_login_at);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertOk();
        $membership = SchoolMembership::where('user_id', $teacher->id)->sole();
        $seen = $membership->last_seen_at;
        $this->assertNotNull($seen);

        // Not rewritten on every request: at most every 5 minutes.
        $this->travel(2)->minutes();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertOk();
        $this->assertEquals($seen, $membership->fresh()->last_seen_at);

        $this->travel(4)->minutes();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertOk();
        $this->assertTrue($membership->fresh()->last_seen_at->gt($seen));
    }

    public function test_school_tokens_cannot_read_the_dashboard(): void
    {
        $token = $this->postJson('/api/login', [
            'email' => 'admin@demo.school', 'password' => 'password', 'role' => 'admin',
            'school_id' => School::oldest('id')->value('id'),
        ])->json('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/platform/overview')->assertForbidden();
        $this->withToken($token)->getJson('/api/platform/audit-logs')->assertForbidden();
    }

    public function test_old_audit_entries_are_pruned(): void
    {
        AuditLog::create(['action' => 'old.thing'])->forceFill(['created_at' => now()->subYears(3)])->save();
        AuditLog::create(['action' => 'recent.thing']);

        $this->artisan('audit:prune')->assertSuccessful();

        $this->assertDatabaseMissing('audit_logs', ['action' => 'old.thing']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'recent.thing']);
    }

    private function platform(): self
    {
        $token = $this->systemAdminToken($this->systemAdmin);
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }
}
