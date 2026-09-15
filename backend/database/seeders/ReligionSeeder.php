<?php

namespace Database\Seeders;

use App\Models\Religion;
use Illuminate\Database\Seeder;

class ReligionSeeder extends Seeder
{
    public function run(): void
    {
        $religions = [
            ['en' => 'Islam', 'ar' => 'الإسلام'],
            ['en' => 'Christianity', 'ar' => 'المسيحية'],
            ['en' => 'Other', 'ar' => 'أخرى'],
        ];

        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead, to keep this seeder safe to run more than once.
        $existingEnNames = Religion::all()
            ->map(fn (Religion $religion) => $religion->getTranslation('name', 'en'))
            ->all();

        foreach ($religions as $name) {
            if (in_array($name['en'], $existingEnNames, true)) {
                continue;
            }

            Religion::create(['name' => $name]);
        }
    }
}
