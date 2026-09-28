<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Until step 5, users created through the admin screens (students,
     * parents, teachers) got a role but no membership — and login now
     * requires one. Give any such user a membership at the default school,
     * the same way the step 1 backfill did. Rows that already exist are
     * left alone.
     */
    public function up(): void
    {
        $schoolId = DB::table('schools')->orderBy('id')->value('id');

        if ($schoolId === null) {
            return;
        }

        $now = now();

        DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->join('users', 'users.id', '=', 'model_has_roles.model_id')
            ->where('model_has_roles.model_type', 'App\Models\User')
            ->whereIn('roles.name', ['admin', 'teacher', 'parent', 'student'])
            ->whereNotExists(fn ($q) => $q->from('school_memberships')
                ->whereColumn('school_memberships.user_id', 'users.id')
                ->whereColumn('school_memberships.role', 'roles.name'))
            ->select('users.id as user_id', 'users.created_at', 'roles.name as role')
            ->get()
            ->chunk(500)
            ->each(fn ($chunk) => DB::table('school_memberships')->insertOrIgnore($chunk->map(fn ($a) => [
                'user_id' => $a->user_id,
                'school_id' => $schoolId,
                'role' => $a->role,
                'status' => 'active',
                'started_at' => $a->created_at,
                'created_at' => $now,
                'updated_at' => $now,
            ])->values()->all()));
    }

    public function down(): void
    {
        // Nothing to undo: these are ordinary memberships from here on.
    }
};
