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
        Schema::create('fees', function (Blueprint $table) {
            $table->id();
            $table->json('name');
            $table->foreignId('academic_year_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 10, 2);
            // When true the fee applies to every student regardless of
            // stage/grade, and stage_id/grade_id stay null — otherwise it's
            // scoped to one grade within one stage (see Store/UpdateFeeRequest).
            $table->boolean('is_for_all')->default(false);
            $table->foreignId('stage_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('grade_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fees');
    }
};
