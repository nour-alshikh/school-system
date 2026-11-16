<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A system admin inside a school as its admin (docs/central-dashboard-plan.md,
     * phase 5): the session, the token bound to it, and the re-confirmation
     * (a fresh two-factor code) that entering needs.
     */
    public function up(): void
    {
        Schema::create('platform_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 500)->nullable();
            $table->dateTime('started_at');
            $table->dateTime('expires_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['school_id', 'started_at']);
        });

        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->foreignId('platform_session_id')->nullable()->after('school_membership_id')->constrained()->cascadeOnDelete();
            // Sudo mode: when this (platform) token last re-confirmed with a code.
            $table->timestamp('platform_confirmed_at')->nullable()->after('platform_session_id');
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('platform_session_id');
            $table->dropColumn('platform_confirmed_at');
        });

        Schema::dropIfExists('platform_sessions');
    }
};
