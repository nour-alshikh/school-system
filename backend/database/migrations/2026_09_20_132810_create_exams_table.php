<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exams', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            // Cast to App\Enums\ExamType on the model — see Exam::$casts.
            $table->string('type');
            $table->foreignId('subject_id')->constrained()->restrictOnDelete();
            $table->foreignId('grade_id')->constrained()->restrictOnDelete();
            // Null = the whole grade (every classroom in it), not just one —
            // see Exam::classroom() and the eligibility query in
            // StudentPortal\ExamController.
            $table->foreignId('classroom_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            // Nullable since the creating user could later be deleted without
            // invalidating the exam itself — same convention as
            // attendances.recorded_by.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('instructions')->nullable();
            $table->unsignedInteger('duration_minutes');
            $table->dateTime('opens_at');
            $table->dateTime('closes_at');
            // Cast to App\Enums\ExamStatus on the model — see Exam::$casts.
            $table->string('status')->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exams');
    }
};
