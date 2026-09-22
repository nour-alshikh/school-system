<?php

namespace Database\Seeders;

use App\Enums\SettingGroup;
use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            ['key' => 'school_name', 'value' => 'School System', 'group' => SettingGroup::General->value],
            ['key' => 'tagline', 'value' => null, 'group' => SettingGroup::General->value],

            ['key' => 'logo', 'value' => null, 'group' => SettingGroup::Branding->value],
            ['key' => 'favicon', 'value' => null, 'group' => SettingGroup::Branding->value],
            ['key' => 'primary_color', 'value' => null, 'group' => SettingGroup::Branding->value],

            ['key' => 'address', 'value' => null, 'group' => SettingGroup::Contact->value],
            ['key' => 'phone', 'value' => null, 'group' => SettingGroup::Contact->value],
            ['key' => 'email', 'value' => null, 'group' => SettingGroup::Contact->value],

            ['key' => 'facebook_url', 'value' => null, 'group' => SettingGroup::Social->value],
            ['key' => 'twitter_url', 'value' => null, 'group' => SettingGroup::Social->value],
            ['key' => 'instagram_url', 'value' => null, 'group' => SettingGroup::Social->value],
            ['key' => 'youtube_url', 'value' => null, 'group' => SettingGroup::Social->value],
            ['key' => 'linkedin_url', 'value' => null, 'group' => SettingGroup::Social->value],
        ];

        foreach ($defaults as $setting) {
            Setting::firstOrCreate(['key' => $setting['key']], $setting);
        }
    }
}
