<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Step 1 of docs/multi-tenancy.md: the existing single-tenant data
     * becomes the first school, and every user gets a membership matching
     * their current spatie role. Query builder only (no models), so this
     * keeps working if the models change later.
     */
    public function up(): void
    {
        $name = DB::table('settings')->where('key', 'school_name')->value('value') ?: 'School System';
        $now = now();

        $schoolId = DB::table('schools')->insertGetId([
            'name' => $name,
            'slug' => Str::slug($name) ?: 'school',
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $assignments = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->whereIn('roles.name', ['admin', 'teacher', 'parent', 'student'])
            ->select('users.id as user_id', 'users.created_at', 'roles.name as role')
            ->get();

        $rows = $assignments->map(fn ($a) => [
            'user_id' => $a->user_id,
            'school_id' => $schoolId,
            'role' => $a->role,
            'status' => 'active',
            'started_at' => $a->created_at,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        foreach ($rows->chunk(500) as $chunk) {
            DB::table('school_memberships')->insert($chunk->values()->all());
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('school_memberships')->delete();
        DB::table('schools')->delete();
    }
};
