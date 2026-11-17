<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The assistant's chat history (docs/ai-assistant-plan.md, phase 4):
     * per user and school, so it can continue a conversation and bad
     * answers can be looked into. Deleted after 30 days (assistant:prune).
     */
    public function up(): void
    {
        Schema::create('assistant_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('school_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->timestamps();

            $table->index(['user_id', 'school_id', 'updated_at']);
            $table->index('updated_at');
        });

        Schema::create('assistant_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('assistant_conversations')->cascadeOnDelete();
            $table->string('role', 16); // user | assistant
            $table->text('content');
            // Pages the answer links to (paths from the app's navigation).
            $table->json('links')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_messages');
        Schema::dropIfExists('assistant_conversations');
    }
};
