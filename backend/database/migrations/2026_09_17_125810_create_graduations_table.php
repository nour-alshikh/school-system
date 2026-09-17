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
        Schema::create('graduations', function (Blueprint $table) {
            $table->id();
            // Unlike promotions' from_*/to_* pair, a graduation has no
            // destination — stage/grade/classroom/academic_year here are
            // just a snapshot of where the student stood at graduation
            // time (those columns don't change on the student's own row,
            // see GraduationService::graduate, but the snapshot still
            // protects this history if the live record is edited later).
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stage_id')->constrained('stages')->restrictOnDelete();
            $table->foreignId('grade_id')->constrained('grades')->restrictOnDelete();
            $table->foreignId('classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained('academic_years')->restrictOnDelete();
            // Nullable for the same reason promotions.promoted_by is: keep
            // the record if the admin who made it is later deleted.
            $table->foreignId('graduated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rolled_back_at')->nullable();
            $table->foreignId('rolled_back_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('graduations');
    }
};
