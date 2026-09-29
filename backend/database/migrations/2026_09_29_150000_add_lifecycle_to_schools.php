<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * School lifecycle (docs/central-dashboard-plan.md, phase 7): why a
     * school is suspended or archived (shown to its members at sign-in),
     * when it was archived (reversible for 30 days), and data exports.
     */
    public function up(): void
    {
        Schema::table('schools', function (Blueprint $table) {
            $table->string('status_reason', 500)->nullable()->after('status');
            $table->timestamp('archived_at')->nullable()->after('status_reason');
        });

        Schema::create('school_exports', function (Blueprint $table) {
            $table->id();
            // No foreign key: an export outlives a purged school's rows.
            $table->unsignedBigInteger('school_id')->index();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('path');
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('school_exports');

        Schema::table('schools', function (Blueprint $table) {
            $table->dropColumn(['status_reason', 'archived_at']);
        });
    }
};
