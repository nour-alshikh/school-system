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
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            // The student's own stage/grade/classroom/academic_year get
            // overwritten by the promotion itself — every from_*/to_* column
            // here is a snapshot taken at promotion time, the only place
            // that history survives.
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_stage_id')->constrained('stages')->restrictOnDelete();
            $table->foreignId('from_grade_id')->constrained('grades')->restrictOnDelete();
            $table->foreignId('from_classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->foreignId('from_academic_year_id')->constrained('academic_years')->restrictOnDelete();
            $table->foreignId('to_stage_id')->constrained('stages')->restrictOnDelete();
            $table->foreignId('to_grade_id')->constrained('grades')->restrictOnDelete();
            $table->foreignId('to_classroom_id')->constrained('classrooms')->restrictOnDelete();
            $table->foreignId('to_academic_year_id')->constrained('academic_years')->restrictOnDelete();
            // Nullable: keep the promotion record if the admin who made it is
            // later deleted — only the attribution is lost, not the history.
            $table->foreignId('promoted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
