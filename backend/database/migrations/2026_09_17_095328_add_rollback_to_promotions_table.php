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
        Schema::table('promotions', function (Blueprint $table) {
            $table->timestamp('rolled_back_at')->nullable();
            // Nullable for the same reason promoted_by is: keep the record
            // if the admin who rolled it back is later deleted.
            $table->foreignId('rolled_back_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('rolled_back_by');
            $table->dropColumn('rolled_back_at');
        });
    }
};
