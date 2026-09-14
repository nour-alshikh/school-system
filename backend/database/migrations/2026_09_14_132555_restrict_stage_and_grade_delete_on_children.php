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
        Schema::table('grades', function (Blueprint $table) {
            $table->dropForeign(['stage_id']);
            $table->foreign('stage_id')->references('id')->on('stages')->restrictOnDelete();
        });

        Schema::table('classrooms', function (Blueprint $table) {
            $table->dropForeign(['grade_id']);
            $table->foreign('grade_id')->references('id')->on('grades')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grades', function (Blueprint $table) {
            $table->dropForeign(['stage_id']);
            $table->foreign('stage_id')->references('id')->on('stages')->cascadeOnDelete();
        });

        Schema::table('classrooms', function (Blueprint $table) {
            $table->dropForeign(['grade_id']);
            $table->foreign('grade_id')->references('id')->on('grades')->cascadeOnDelete();
        });
    }
};
