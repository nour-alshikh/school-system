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
        // A subject taught to a whole stage (every grade under it) instead of
        // one specific grade — see subject_grade for the other half of the
        // either/or scope a subject is validated to have (Subject/Store and
        // UpdateSubjectRequest require exactly one of stage_ids/grade_ids).
        Schema::create('subject_stage', function (Blueprint $table) {
            $table->foreignId('subject_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stage_id')->constrained()->cascadeOnDelete();
            $table->primary(['subject_id', 'stage_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subject_stage');
    }
};
