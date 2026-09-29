<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * When people last signed in and were last active at each school
     * (docs/central-dashboard-plan.md, phase 3), for the central dashboard's
     * activity numbers and warnings.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable()->after('remember_token');
        });

        Schema::table('school_memberships', function (Blueprint $table) {
            $table->timestamp('last_seen_at')->nullable()->after('ended_at');
            $table->index(['school_id', 'last_seen_at']);
        });
    }

    public function down(): void
    {
        Schema::table('school_memberships', function (Blueprint $table) {
            $table->dropIndex(['school_id', 'last_seen_at']);
            $table->dropColumn('last_seen_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_login_at');
        });
    }
};
