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
        // A teacher going inactive frees up the classrooms/subjects they were
        // teaching rather than silently deleting the assignment — see
        // TeacherController::update(), which nulls teacher_id here instead
        // of removing the row when a teacher's status becomes "inactive".
        Schema::table('classroom_subject_teacher', function (Blueprint $table) {
            $table->foreignId('teacher_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('classroom_subject_teacher', function (Blueprint $table) {
            $table->foreignId('teacher_id')->nullable(false)->change();
        });
    }
};
