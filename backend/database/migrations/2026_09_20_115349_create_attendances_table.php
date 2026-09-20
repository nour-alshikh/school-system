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
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            // Snapshotted at mark time rather than read off students.classroom_id
            // — a student promoted to a new classroom shouldn't rewrite the
            // classroom on their past attendance rows.
            $table->foreignId('classroom_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->date('date');
            // Cast to App\Enums\AttendanceStatus on the model — see
            // Attendance::$casts.
            $table->string('status');
            $table->text('notes')->nullable();
            // Who marked it — nullable since the marking user could later be
            // deleted without invalidating the attendance record itself.
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['student_id', 'date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
