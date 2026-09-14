<?php

namespace Database\Seeders;

use App\Models\Stage;
use Illuminate\Database\Seeder;

class StageSeeder extends Seeder
{
    public function run(): void
    {
        $stages = [
            ['en' => 'Primary', 'ar' => 'الابتدائية'],
            ['en' => 'Preparatory', 'ar' => 'الإعدادية'],
            ['en' => 'Secondary', 'ar' => 'الثانوية'],
        ];

        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead, to keep this seeder safe to run more than once.
        $existingEnNames = Stage::all()
            ->map(fn (Stage $stage) => $stage->getTranslation('name', 'en'))
            ->all();

        foreach ($stages as $name) {
            if (in_array($name['en'], $existingEnNames, true)) {
                continue;
            }

            Stage::create(['name' => $name]);
        }
    }
}
