<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The assistant's data answers (docs/ai-assistant-plan.md, phase 5):
     * the assistant_data setting row for existing schools — empty, which
     * means off: school data reaches the AI provider only once an admin
     * turns it on. New schools get the row from SchoolProvisioner. And the
     * lookups behind each answer, kept with it for looking into bad answers.
     */
    public function up(): void
    {
        $now = now();
        $have = DB::table('settings')->where('key', 'assistant_data')->pluck('school_id')->all();

        foreach (DB::table('schools')->whereNotIn('id', $have)->pluck('id') as $schoolId) {
            DB::table('settings')->insert([
                'school_id' => $schoolId,
                'key' => 'assistant_data',
                'value' => null,
                'group' => 'general',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('assistant_messages', function (Blueprint $table) {
            // [{"tool": "attendance_summary", "args": {...}, "ok": true}]
            $table->json('tools')->nullable()->after('links');
        });
    }

    public function down(): void
    {
        Schema::table('assistant_messages', fn (Blueprint $table) => $table->dropColumn('tools'));
        DB::table('settings')->where('key', 'assistant_data')->delete();
    }
};
