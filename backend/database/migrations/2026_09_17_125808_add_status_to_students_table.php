<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // Stays 'active' through every promotion — only
            // GraduationService flips it, and only to 'graduated'. Kept as
            // a plain string (see Gender) rather than a DB enum so adding a
            // status later doesn't need a migration.
            $table->string('status')->default('active')->after('academic_year_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
