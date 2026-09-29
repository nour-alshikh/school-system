<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Where a school came from (see docs/self-service-schools-plan.md): a
     * platform admin, the public signup, or a seeder. Existing schools were
     * all made by the platform (or its migration), so they keep the default.
     */
    public function up(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            // Who created it through self-service; null for platform/seeded schools.
            $table->foreignId('created_by_id')->nullable()->after('status')->constrained('users')->nullOnDelete();
            // Plain string, same reasoning as schools.status (see SchoolSource).
            $table->string('source')->default('platform')->after('created_by_id');
        });
    }

    public function down(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by_id');
            $table->dropColumn('source');
        });
    }
};
