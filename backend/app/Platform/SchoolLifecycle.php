<?php

namespace App\Platform;

use App\Enums\SchoolStatus;
use App\Models\AuditLog;
use App\Models\PersonalAccessToken;
use App\Models\PlatformSession;
use App\Models\School;
use App\Models\SchoolExport;
use App\Models\SchoolMembership;
use App\Models\Setting;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use ZipArchive;

/**
 * A school's lifecycle, from the central dashboard
 * (docs/central-dashboard-plan.md, phase 7): edit, suspend, archive
 * (reversible for ARCHIVE_DAYS), export, and — CLI only — purge.
 */
class SchoolLifecycle
{
    public const ARCHIVE_DAYS = 30;

    /** Settings a system admin may edit from the dashboard. Files (logo) stay in the school's own settings page. */
    public const EDITABLE_SETTINGS = ['primary_color', 'email', 'phone', 'address'];

    public function __construct(
        private readonly TenantContext $context,
        private readonly SchoolTables $tables,
    ) {}

    /**
     * @param  array{name?: string, slug?: string, settings?: array<string, string|null>}  $data
     */
    public function update(School $school, array $data): void
    {
        $before = $school->only(['name', 'slug']);
        $school->update(array_intersect_key($data, array_flip(['name', 'slug'])));
        $changes = array_intersect_key($school->getChanges(), $before);

        $settings = array_intersect_key($data['settings'] ?? [], array_flip(self::EDITABLE_SETTINGS));
        if ($settings) {
            $this->context->runAs($school, function () use ($settings) {
                foreach ($settings as $key => $value) {
                    Setting::where('key', $key)->update(['value' => $value ?: null]);
                }
            });
        }

        if ($changes || $settings) {
            AuditLog::record('school.updated', $school, array_filter([
                'before' => array_intersect_key($before, $changes) ?: null,
                'after' => $changes ?: null,
                'settings' => $settings ? array_keys($settings) : null,
            ]));
        }
    }

    /**
     * Active, suspended or archived. Suspending and archiving sign every
     * member out (ResolveSchool) and show $reason at sign-in. An archived
     * school can be brought back only within ARCHIVE_DAYS.
     */
    public function setStatus(School $school, SchoolStatus $status, ?string $reason): void
    {
        if ($school->status === SchoolStatus::Archived && $status === SchoolStatus::Active && $school->archived_at?->lt(now()->subDays(self::ARCHIVE_DAYS))) {
            throw ValidationException::withMessages(['status' => __('api.archive_expired', ['days' => self::ARCHIVE_DAYS])]);
        }

        $school->update([
            'status' => $status,
            'status_reason' => $status === SchoolStatus::Active ? null : $reason,
            'archived_at' => $status === SchoolStatus::Archived ? ($school->archived_at ?? now()) : null,
        ]);

        AuditLog::record(match ($status) {
            SchoolStatus::Active => 'school.reactivated',
            SchoolStatus::Suspended => 'school.suspended',
            SchoolStatus::Archived => 'school.archived',
        }, $school, array_filter(['reason' => $reason]));
    }

    /**
     * A zip of everything that is the school's: one JSON file per table
     * (its rows), its members (no passwords), and its files on both disks.
     * Runs inline for now: no queue worker is set up (docs/gaps.md) — move
     * it into a queued job once there is one.
     */
    public function export(School $school, User $by): SchoolExport
    {
        $path = "exports/school-{$school->id}-".now()->format('Ymd-His').'.zip';
        $absolute = Storage::disk('local')->path($path);
        Storage::disk('local')->makeDirectory('exports');

        $zip = new ZipArchive;
        if ($zip->open($absolute, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException("Could not create {$path}");
        }

        $zip->addFromString('school.json', $this->json($school->only(['id', 'name', 'slug', 'status', 'source', 'created_at'])));

        foreach ($this->tables->all() as $table) {
            $zip->addFromString("data/{$table}.json", $this->json(DB::table($table)->where('school_id', $school->id)->get()));
        }

        $zip->addFromString('data/members.json', $this->json(
            DB::table('school_memberships')
                ->join('users', 'users.id', '=', 'school_memberships.user_id')
                ->where('school_memberships.school_id', $school->id)
                ->get(['school_memberships.id', 'users.id as user_id', 'users.name', 'users.email', 'school_memberships.role', 'school_memberships.status', 'school_memberships.started_at', 'school_memberships.ended_at'])
        ));

        foreach (['public', 'local'] as $disk) {
            foreach (Storage::disk($disk)->allFiles("schools/{$school->id}") as $file) {
                $zip->addFile(Storage::disk($disk)->path($file), "files/{$disk}/{$file}");
            }
        }

        $zip->close();

        $export = SchoolExport::create([
            'school_id' => $school->id,
            'created_by' => $by->id,
            'path' => $path,
            'size' => filesize($absolute) ?: 0,
            'expires_at' => now()->addHours(SchoolExport::HOURS),
        ]);

        AuditLog::record('school.exported', $school, ['export_id' => $export->id, 'size' => $export->size]);

        return $export;
    }

    /**
     * Deletes the school and everything that is its own. Only an archived
     * school with an export may be purged; users whose only membership was
     * here are deleted, users with other schools keep their accounts. The
     * audit log and exports stay. CLI only (school:purge).
     *
     * @return array{rows: int, users: int}
     */
    public function purge(School $school, bool $ignoreWait = false): array
    {
        if ($school->status !== SchoolStatus::Archived) {
            throw new RuntimeException('Only an archived school can be purged. Archive it first.');
        }
        if (! $ignoreWait && $school->archived_at?->gt(now()->subDays(self::ARCHIVE_DAYS))) {
            throw new RuntimeException('It was archived less than '.self::ARCHIVE_DAYS.' days ago and can still be restored. Wait, or pass --now.');
        }
        if (! SchoolExport::where('school_id', $school->id)->exists()) {
            throw new RuntimeException('Export the school first (Export on its page in the central dashboard).');
        }

        $userIds = SchoolMembership::where('school_id', $school->id)->pluck('user_id')->unique();
        $rows = 0;

        DB::transaction(function () use ($school, &$rows) {
            foreach ($this->tables->deletionOrder() as $table) {
                $rows += DB::table($table)->where('school_id', $school->id)->delete();
            }

            $membershipIds = SchoolMembership::where('school_id', $school->id)->pluck('id');
            PersonalAccessToken::whereIn('school_membership_id', $membershipIds)->delete();
            PlatformSession::where('school_id', $school->id)->delete();
            // Per-school role assignments (spatie teams), and any role made for this school.
            foreach (['model_has_roles', 'model_has_permissions', 'roles'] as $table) {
                if (Schema::hasColumn($table, 'school_id')) {
                    DB::table($table)->where('school_id', $school->id)->delete();
                }
            }
            SchoolMembership::where('school_id', $school->id)->delete();
        });

        foreach (['public', 'local'] as $disk) {
            Storage::disk($disk)->deleteDirectory("schools/{$school->id}");
        }

        // Accounts that belonged only to this school (never a system admin).
        $orphans = User::whereIn('id', $userIds)
            ->where('is_platform_admin', false)
            ->whereDoesntHave('memberships')
            ->get();
        foreach ($orphans as $user) {
            $user->tokens()->delete();
            $user->delete();
        }

        AuditLog::record('school.purged', details: ['name' => $school->name, 'slug' => $school->slug, 'rows' => $rows, 'users_deleted' => $orphans->count()], school: $school);
        $school->delete();

        return ['rows' => $rows, 'users' => $orphans->count()];
    }

    private function json(mixed $data): string
    {
        return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
