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
        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Nullable only because it's a plain column, not a hard app
            // invariant — StudentService::register() always sets it in the
            // same transaction that creates the student.
            $table->foreignId('parent_user_id')->nullable()->constrained('users')->cascadeOnDelete();
            // JSON object of locale => name (see Student::$translatable),
            // e.g. {"en": "Ali Hassan", "ar": "علي حسن"}.
            $table->text('name');
            $table->string('gender');
            $table->foreignId('nationality_id')->constrained()->restrictOnDelete();
            $table->foreignId('governorate_id')->constrained()->restrictOnDelete();
            $table->foreignId('blood_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('stage_id')->constrained()->restrictOnDelete();
            $table->foreignId('grade_id')->constrained()->restrictOnDelete();
            $table->foreignId('classroom_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
