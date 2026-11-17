<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What an answer proposes doing (docs/ai-assistant-plan.md, phase 6):
     * {"name", "fields", "warnings", "status": proposed|done|dismissed}, so
     * its confirm card comes back with the conversation, and isn't offered
     * again once it's been confirmed or dismissed.
     */
    public function up(): void
    {
        Schema::table('assistant_messages', function (Blueprint $table) {
            $table->json('action')->nullable()->after('tools');
        });
    }

    public function down(): void
    {
        Schema::table('assistant_messages', fn (Blueprint $table) => $table->dropColumn('action'));
    }
};
