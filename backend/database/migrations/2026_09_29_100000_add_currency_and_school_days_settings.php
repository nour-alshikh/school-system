<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Each school's admin chooses its currency and school week (see
     * docs/demo-seeder-plan.md, step 0). New schools get the rows from
     * SchoolProvisioner::DEFAULT_SETTINGS; this adds them, empty, for the
     * schools that already exist. The settings form can only update rows
     * that exist.
     */
    private const KEYS = ['currency', 'school_days'];

    public function up(): void
    {
        $now = now();

        foreach (DB::table('schools')->pluck('id') as $schoolId) {
            $existing = DB::table('settings')->where('school_id', $schoolId)->whereIn('key', self::KEYS)->pluck('key')->all();

            foreach (array_diff(self::KEYS, $existing) as $key) {
                DB::table('settings')->insert([
                    'school_id' => $schoolId,
                    'key' => $key,
                    'value' => null,
                    'group' => 'general',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('settings')->whereIn('key', self::KEYS)->delete();
    }
};
