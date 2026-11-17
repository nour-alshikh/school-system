<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per AI call (docs/ai-assistant-plan.md, rule 7): who, where,
     * what for, and how it went — never the text sent or received. Read by
     * the daily caps and the central dashboard. Platform-wide like
     * audit_logs; school_id has no foreign key so a purged school's usage
     * still adds up.
     */
    public function up(): void
    {
        Schema::create('ai_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('school_id')->nullable();
            $table->string('feature', 100);
            $table->string('model')->nullable();
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->unsignedInteger('duration_ms');
            $table->boolean('ok');
            // A short reason when it failed (unreachable, http_429, bad_reply …).
            $table->string('error', 100)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['school_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage');
    }
};
