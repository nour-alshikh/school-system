<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('exam_attempt_answers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attempt_id')->constrained('exam_attempts')->cascadeOnDelete();
            $table->foreignId('question_id')->constrained('exam_questions')->cascadeOnDelete();
            // Nullable — a student can leave a question unanswered and still
            // submit; graded as incorrect (0 marks).
            $table->foreignId('selected_option_id')->nullable()->constrained('exam_question_options')->nullOnDelete();
            $table->boolean('is_correct')->nullable();
            $table->unsignedInteger('marks_awarded')->default(0);
            $table->timestamps();

            $table->unique(['attempt_id', 'question_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_attempt_answers');
    }
};
