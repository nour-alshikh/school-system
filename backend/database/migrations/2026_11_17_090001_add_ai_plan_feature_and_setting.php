<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * AI features (docs/ai-assistant-plan.md, phase 1): the "ai" plan
     * feature on Standard and Unlimited (not Basic, like meetings), and the
     * ai_enabled setting row for existing schools — empty, which means on.
     * New schools get the row from SchoolProvisioner::DEFAULT_SETTINGS.
     */
    private const PLANS = ['standard', 'unlimited'];

    public function up(): void
    {
        foreach (DB::table('plans')->whereIn('key', self::PLANS)->get() as $plan) {
            $features = json_decode($plan->features, true) ?: [];
            if (! in_array('ai', $features, true)) {
                DB::table('plans')->where('id', $plan->id)->update(['features' => json_encode([...$features, 'ai'])]);
            }
        }

        $now = now();
        $have = DB::table('settings')->where('key', 'ai_enabled')->pluck('school_id')->all();

        foreach (DB::table('schools')->whereNotIn('id', $have)->pluck('id') as $schoolId) {
            DB::table('settings')->insert([
                'school_id' => $schoolId,
                'key' => 'ai_enabled',
                'value' => null,
                'group' => 'general',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('settings')->where('key', 'ai_enabled')->delete();

        foreach (DB::table('plans')->get() as $plan) {
            $features = json_decode($plan->features, true) ?: [];
            DB::table('plans')->where('id', $plan->id)->update(['features' => json_encode(array_values(array_diff($features, ['ai'])))]);
        }
    }
};
