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
        Schema::create('fathers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('job');
            $table->string('national_id');
            $table->string('phone');
            $table->foreignId('nationality_id')->constrained()->restrictOnDelete();
            $table->foreignId('governorate_id')->constrained()->restrictOnDelete();
            $table->foreignId('blood_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('religion_id')->constrained()->restrictOnDelete();
            $table->text('address');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fathers');
    }
};
