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
        Schema::create('school_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Restrict, not cascade: deleting a school must be a deliberate
            // offboarding step, never a side effect.
            $table->foreignId('school_id')->constrained()->restrictOnDelete();
            $table->string('role');
            $table->string('status')->default('active');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            // Same user can hold several roles at one school (e.g. teacher
            // and parent), but each role only once.
            $table->unique(['user_id', 'school_id', 'role']);
            $table->index(['school_id', 'role']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('school_memberships');
    }
};
