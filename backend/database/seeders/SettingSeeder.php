<?php

namespace Database\Seeders;

use App\Services\SchoolProvisioner;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    /**
     * The default school's settings — the same rows every new school gets
     * (see SchoolProvisioner::DEFAULT_SETTINGS).
     */
    public function run(): void
    {
        app(SchoolProvisioner::class)->seedDefaultSettings(['school_name' => 'School System']);
    }
}
