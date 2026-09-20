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
        Schema::create('fee_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fee_charge_id')->constrained()->cascadeOnDelete();
            // Positive = payment, negative = refund/correction. Payments are
            // append-only (no edit/delete route) so this stays an audit
            // trail — a mistake gets fixed with an offsetting entry, not a
            // rewrite of history.
            $table->decimal('amount', 10, 2);
            $table->date('paid_at');
            $table->string('method');
            $table->text('note')->nullable();
            $table->foreignId('recorded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fee_payments');
    }
};
