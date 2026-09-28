<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Step 6 of docs/multi-tenancy.md: spatie/laravel-permission teams, with
     * the school as the team. A role assignment now says "teacher *at school
     * A*", so a teacher at A who is a parent at B is only a parent while
     * signed in to B.
     *
     * A fresh install already gets team-shaped tables from the original
     * permission migration (config/permission.php has teams on), so this
     * only converts databases created before that.
     *
     * Existing assignments are rebuilt from school_memberships: one row per
     * membership. The base 'user' role is removed — it granted nothing, and
     * with teams every assignment needs a school, which a plain account
     * doesn't have.
     */
    private const SCHOOL_ROLES = ['admin', 'teacher', 'parent', 'student'];

    public function up(): void
    {
        if (! Schema::hasColumn('model_has_roles', 'school_id')) {
            $roleRows = $this->roleRowsFromMemberships();
            $permissionRows = $this->permissionRowsPerMembershipSchool();

            Schema::table('roles', function (Blueprint $table) {
                $table->unsignedBigInteger('school_id')->nullable()->after('id');
                $table->index('school_id', 'roles_team_foreign_key_index');
                $table->dropUnique(['name', 'guard_name']);
                $table->unique(['school_id', 'name', 'guard_name']);
            });

            $this->recreatePivot('model_has_roles', 'role_id', 'roles', teams: true);
            $this->recreatePivot('model_has_permissions', 'permission_id', 'permissions', teams: true);

            $this->insertChunked('model_has_roles', $roleRows);
            $this->insertChunked('model_has_permissions', $permissionRows);
        }

        DB::table('roles')->where('name', 'user')->delete();

        app('cache')->forget(config('permission.cache.key'));
    }

    public function down(): void
    {
        $roleRows = DB::table('model_has_roles')->select('role_id', 'model_type', 'model_id')->distinct()->get()
            ->map(fn ($r) => (array) $r)->all();
        $permissionRows = DB::table('model_has_permissions')->select('permission_id', 'model_type', 'model_id')->distinct()->get()
            ->map(fn ($r) => (array) $r)->all();

        $this->recreatePivot('model_has_roles', 'role_id', 'roles', teams: false);
        $this->recreatePivot('model_has_permissions', 'permission_id', 'permissions', teams: false);

        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique(['school_id', 'name', 'guard_name']);
            $table->dropIndex('roles_team_foreign_key_index');
            $table->dropColumn('school_id');
            $table->unique(['name', 'guard_name']);
        });

        $this->insertChunked('model_has_roles', $roleRows);
        $this->insertChunked('model_has_permissions', $permissionRows);

        app('cache')->forget(config('permission.cache.key'));
    }

    /** @return list<array<string, mixed>> */
    private function roleRowsFromMemberships(): array
    {
        return DB::table('school_memberships')
            ->join('roles', 'roles.name', '=', 'school_memberships.role')
            ->whereIn('school_memberships.role', self::SCHOOL_ROLES)
            ->where('roles.guard_name', 'web')
            ->select('school_memberships.school_id', 'roles.id as role_id', 'school_memberships.user_id as model_id')
            ->distinct()
            ->get()
            ->map(fn ($r) => [
                'school_id' => $r->school_id,
                'role_id' => $r->role_id,
                'model_type' => 'App\\Models\\User',
                'model_id' => $r->model_id,
            ])
            ->all();
    }

    /**
     * Direct (non-role) permissions, if any: kept at every school the user
     * belongs to.
     *
     * @return list<array<string, mixed>>
     */
    private function permissionRowsPerMembershipSchool(): array
    {
        return DB::table('model_has_permissions')
            ->join('school_memberships', function ($join) {
                $join->on('school_memberships.user_id', '=', 'model_has_permissions.model_id')
                    ->where('model_has_permissions.model_type', 'App\\Models\\User');
            })
            ->select('school_memberships.school_id', 'model_has_permissions.permission_id', 'model_has_permissions.model_type', 'model_has_permissions.model_id')
            ->distinct()
            ->get()
            ->map(fn ($r) => (array) $r)
            ->all();
    }

    /**
     * Same shape as spatie's own create_permission_tables migration, with or
     * without the team column.
     */
    private function recreatePivot(string $name, string $key, string $references, bool $teams): void
    {
        Schema::drop($name);

        Schema::create($name, function (Blueprint $table) use ($name, $key, $references, $teams) {
            $table->unsignedBigInteger($key);
            $table->string('model_type');
            $table->unsignedBigInteger('model_id');
            $table->index(['model_id', 'model_type'], "{$name}_model_id_model_type_index");
            $table->foreign($key)->references('id')->on($references)->onDelete('cascade');

            $primaryName = $name === 'model_has_roles' ? 'model_has_roles_role_model_type_primary' : 'model_has_permissions_permission_model_type_primary';

            if ($teams) {
                $table->unsignedBigInteger('school_id');
                $table->index('school_id', "{$name}_team_foreign_key_index");
                $table->primary(['school_id', $key, 'model_id', 'model_type'], $primaryName);
            } else {
                $table->primary([$key, 'model_id', 'model_type'], $primaryName);
            }
        });
    }

    /** @param list<array<string, mixed>> $rows */
    private function insertChunked(string $table, array $rows): void
    {
        foreach (array_chunk($rows, 500) as $chunk) {
            DB::table($table)->insert($chunk);
        }
    }
};
