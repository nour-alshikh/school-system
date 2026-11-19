<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\SchoolStatus;
use App\Models\AuditLog;
use App\Models\School;
use App\Models\SchoolExport;
use App\Models\SchoolMembership;
use App\Models\Setting;
use App\Models\Student;
use App\Models\User;
use App\Platform\SchoolLifecycle;
use App\Platform\SchoolTables;
use App\Services\MembershipService;
use App\Services\SchoolProvisioner;
use App\Tenancy\TenantContext;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\SignsInAsSystemAdmin;
use Tests\TestCase;
use ZipArchive;

/**
 * Phase 7 of docs/central-dashboard-plan.md: edit, suspend, archive, export
 * and purge a school.
 */
class SchoolLifecycleTest extends TestCase
{
    use RefreshDatabase;
    use SignsInAsSystemAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();
    }

    public function test_a_school_can_be_edited(): void
    {
        [$school, $token] = $this->basicSetup();

        $this->platform($token)->patchJson("/api/platform/schools/{$school->id}", [
            'name' => 'Renamed', 'slug' => $school->slug, 'settings' => ['primary_color' => '#123456', 'phone' => '0100'],
        ])->assertOk()->assertJsonPath('school.name', 'Renamed');

        $this->assertSame('#123456', app(TenantContext::class)->runAs($school, fn () => Setting::valueOf('primary_color')));
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.updated', 'school_id' => $school->id]);

        $this->platform($token)->patchJson("/api/platform/schools/{$school->id}", ['slug' => 'admin'])->assertJsonValidationErrors('slug');
    }

    public function test_suspending_needs_a_reason_and_members_see_it_at_sign_in(): void
    {
        [$school, $token] = $this->basicSetup();
        $teacher = $this->member($school, MembershipRole::Teacher);

        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'suspended'])->assertJsonValidationErrors('reason');
        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'suspended', 'reason' => 'Contact billing@example.com.'])
            ->assertOk()
            ->assertJsonPath('school.status_reason', 'Contact billing@example.com.');

        $message = $this->flushHeaders()->postJson('/api/login', ['email' => $teacher->email, 'password' => 'password', 'role' => 'teacher'])
            ->assertJsonValidationErrors('email')
            ->json('errors.email.0');
        $this->assertStringContainsString('suspended', $message);
        $this->assertStringContainsString('Contact billing@example.com.', $message);

        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'active'])->assertOk()->assertJsonPath('school.status_reason', null);
        $this->flushHeaders()->postJson('/api/login', ['email' => $teacher->email, 'password' => 'password', 'role' => 'teacher'])->assertOk();
    }

    public function test_an_archived_school_can_be_restored_only_within_30_days(): void
    {
        [$school, $token] = $this->basicSetup();

        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'archived', 'reason' => 'Closed'])->assertOk();
        $this->assertNotNull($school->fresh()->archived_at);

        $this->travel(29)->days();
        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'active'])->assertOk();

        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'archived', 'reason' => 'Closed'])->assertOk();
        $this->travel(31)->days();
        $this->platform($token)->postJson("/api/platform/schools/{$school->id}/status", ['status' => 'active'])->assertJsonValidationErrors('status');
    }

    public function test_an_export_has_the_schools_data_and_files_and_no_passwords(): void
    {
        [$school, $token] = $this->basicSetup();
        Storage::disk('local')->put("schools/{$school->id}/9/photo.png", 'png-bytes');

        $export = $this->platform($token)->postJson("/api/platform/schools/{$school->id}/export")->assertCreated()->json('export');
        $zip = new ZipArchive;
        $this->assertTrue($zip->open(Storage::disk('local')->path(SchoolExport::findOrFail($export['id'])->path)));

        $this->assertNotFalse($zip->locateName('school.json'));
        $this->assertNotFalse($zip->locateName('data/settings.json'));
        $this->assertNotFalse($zip->locateName("files/local/schools/{$school->id}/9/photo.png"));
        $members = $zip->getFromName('data/members.json');
        $this->assertStringContainsString('"role": "admin"', $members);
        $this->assertStringNotContainsString('password', $members);
        $zip->close();

        $this->platform($token)->get("/api/platform/exports/{$export['id']}/download")->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'school.export_downloaded']);

        $this->travel(25)->hours();
        $this->platform($token)->getJson("/api/platform/exports/{$export['id']}/download")->assertStatus(410);
    }

    public function test_purge_removes_the_school_and_only_what_is_its_own(): void
    {
        $this->seed(DatabaseSeeder::class);
        $hilltop = School::where('slug', 'hilltop')->sole();
        $default = School::oldest('id')->firstOrFail();
        $defaultStudents = app(TenantContext::class)->runAs($default, fn () => Student::count());

        $onlyHilltop = User::where('email', 'admin@hilltop.demo')->sole();
        $bothSchools = User::where('email', 'shared.teacher@demo.school')->sole();
        $systemAdmin = User::where('email', 'system@demo.school')->sole();

        // Refused until archived, exported and past the restore window.
        $this->artisan('school:purge', ['id' => $hilltop->id, '--confirm' => 'hilltop'])->assertFailed();
        $hilltop->update(['status' => SchoolStatus::Archived, 'archived_at' => now()->subDays(31)]);
        $this->artisan('school:purge', ['id' => $hilltop->id, '--confirm' => 'hilltop'])->assertFailed();
        app(SchoolLifecycle::class)->export($hilltop, $systemAdmin);
        $this->artisan('school:purge', ['id' => $hilltop->id, '--confirm' => 'wrong-slug'])->assertFailed();

        $this->artisan('school:purge', ['id' => $hilltop->id, '--confirm' => 'hilltop'])->assertSuccessful();

        $this->assertNull(School::find($hilltop->id));
        foreach (app(SchoolTables::class)->all() as $table) {
            $this->assertSame(0, DB::table($table)->where('school_id', $hilltop->id)->count(), $table);
        }
        $this->assertSame(0, SchoolMembership::where('school_id', $hilltop->id)->count());

        // Accounts: only-here deleted; shared and system admin kept.
        $this->assertNull(User::find($onlyHilltop->id));
        $this->assertNotNull(User::find($bothSchools->id));
        $this->assertNotNull(User::find($systemAdmin->id));

        // The other school is untouched; history is kept.
        $this->assertSame($defaultStudents, app(TenantContext::class)->runAs($default, fn () => Student::count()));
        $this->assertTrue(AuditLog::where('action', 'school.purged')->where('school_id', $hilltop->id)->exists());
        $this->assertTrue(SchoolExport::where('school_id', $hilltop->id)->exists());
    }

    /** @return array{0: School, 1: string} */
    private function basicSetup(): array
    {
        $this->seed(RolePermissionSeeder::class);
        $school = School::query()->oldest('id')->firstOrFail();
        app(TenantContext::class)->runAs($school, fn () => app(SchoolProvisioner::class)->seedDefaultSettings());
        $this->member($school, MembershipRole::Admin);

        return [$school, $this->systemAdminToken(User::factory()->create(['is_platform_admin' => true]))];
    }

    private function member(School $school, MembershipRole $role): User
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs($school, fn () => app(MembershipService::class)->grant($user, $role));

        return $user;
    }

    private function platform(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }
}
