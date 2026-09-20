<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_id')->constrained()->cascadeOnDelete();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            // Cast to App\Enums\ExamAttemptStatus on the model — see
            // ExamAttempt::$casts.
            $table->string('status')->default('in_progress');
            $table->dateTime('started_at');
            $table->dateTime('submitted_at')->nullable();
            $table->unsignedInteger('score')->nullable();
            $table->timestamps();

            // One attempt per student per exam — enforced here, not just in
            // the controller, so a race between two requests can't slip a
            // second attempt in. See StudentPortal\ExamController::show().
            $table->unique(['exam_id', 'student_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_attempts');
    }
};
