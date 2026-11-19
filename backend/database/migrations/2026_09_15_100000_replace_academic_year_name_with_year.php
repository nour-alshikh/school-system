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
        Schema::table('academic_years', function (Blueprint $table) {
            $table->dropColumn('name');
        });

        Schema::table('academic_years', function (Blueprint $table) {
            // The starting year of the academic year, e.g. 2026 for
            // "2026/2027" — the display string is derived from this single
            // number (see AcademicYearType::fromModel) instead of being
            // freely typed, so every academic year follows the same
            // "YYYY/YYYY+1" pattern.
            //
            // Added nullable, then made required: older SQLite (shared
            // hosting, demo sandboxes) refuses ALTER TABLE ADD COLUMN NOT NULL
            // without a default, while ->change() rebuilds the table there.
            // The resulting schema is the same on every driver.
            $table->unsignedSmallInteger('year')->nullable()->after('id');
        });

        Schema::table('academic_years', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->nullable(false)->change();
            $table->unique('year');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('academic_years', function (Blueprint $table) {
            $table->dropColumn('year');
        });

        Schema::table('academic_years', function (Blueprint $table) {
            $table->text('name')->after('id');
        });
    }
};
