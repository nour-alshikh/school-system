<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Step 5 of docs/multi-tenancy.md: a token is bound to the membership
     * (school + role) it was issued for, and ResolveSchool reads the school
     * from it. Nullable: a plain registered account has no school, and
     * tokens issued before this column existed are resolved from the
     * user's only membership.
     */
    public function up(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->foreignId('school_membership_id')->nullable()->after('tokenable_id')
                ->constrained()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('personal_access_tokens', function (Blueprint $table) {
            $table->dropConstrainedForeignId('school_membership_id');
        });
    }
};
