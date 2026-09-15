<?php

namespace Database\Seeders;

use App\Models\BloodType;
use Illuminate\Database\Seeder;

class BloodTypeSeeder extends Seeder
{
    public function run(): void
    {
        $bloodTypes = [
            ['en' => 'A+', 'ar' => 'أ+'],
            ['en' => 'A-', 'ar' => 'أ-'],
            ['en' => 'B+', 'ar' => 'ب+'],
            ['en' => 'B-', 'ar' => 'ب-'],
            ['en' => 'AB+', 'ar' => 'أ ب+'],
            ['en' => 'AB-', 'ar' => 'أ ب-'],
            ['en' => 'O+', 'ar' => 'O+'],
            ['en' => 'O-', 'ar' => 'O-'],
        ];

        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead, to keep this seeder safe to run more than once.
        $existingEnNames = BloodType::all()
            ->map(fn (BloodType $bloodType) => $bloodType->getTranslation('name', 'en'))
            ->all();

        foreach ($bloodTypes as $name) {
            if (in_array($name['en'], $existingEnNames, true)) {
                continue;
            }

            BloodType::create(['name' => $name]);
        }
    }
}
