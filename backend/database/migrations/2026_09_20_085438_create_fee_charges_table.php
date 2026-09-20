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
        Schema::create('fee_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fee_id')->constrained()->restrictOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            // Snapshot of Fee::amount at charge time — the catalog price can
            // change later without rewriting a student's existing invoice.
            $table->decimal('amount_due', 10, 2);
            $table->string('status')->default('unpaid');
            $table->timestamps();

            // A fee can only be charged to a given student once — re-billing
            // (e.g. a correction) happens through a payment/refund entry or
            // by deleting an unpaid charge and adding a new one, not a
            // duplicate row.
            $table->unique(['student_id', 'fee_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fee_charges');
    }
};
