<?php

namespace Database\Seeders;

use App\Models\Governorate;
use App\Models\Nationality;
use Illuminate\Database\Seeder;

class GovernorateSeeder extends Seeder
{
    public function run(): void
    {
        $egypt = Nationality::all()
            ->first(fn (Nationality $nationality) => $nationality->getTranslation('name', 'en') === 'Egyptian');

        if (! $egypt) {
            throw new \RuntimeException('Egyptian nationality not found — run NationalitySeeder first.');
        }

        $governorates = [
            ['en' => 'Cairo', 'ar' => 'القاهرة'],
            ['en' => 'Alexandria', 'ar' => 'الإسكندرية'],
            ['en' => 'Giza', 'ar' => 'الجيزة'],
            ['en' => 'Qalyubia', 'ar' => 'القليوبية'],
            ['en' => 'Port Said', 'ar' => 'بورسعيد'],
            ['en' => 'Suez', 'ar' => 'السويس'],
            ['en' => 'Dakahlia', 'ar' => 'الدقهلية'],
            ['en' => 'Sharqia', 'ar' => 'الشرقية'],
            ['en' => 'Qena', 'ar' => 'قنا'],
            ['en' => 'Alexandria Suburbs', 'ar' => 'ضواحي الإسكندرية'],
            ['en' => 'Beheira', 'ar' => 'البحيرة'],
            ['en' => 'Fayoum', 'ar' => 'الفيوم'],
            ['en' => 'Gharbia', 'ar' => 'الغربية'],
            ['en' => 'Ismailia', 'ar' => 'الإسماعيلية'],
            ['en' => 'Menofia', 'ar' => 'المنوفية'],
            ['en' => 'Minya', 'ar' => 'المنيا'],
            ['en' => 'Beni Suef', 'ar' => 'بني سويف'],
            ['en' => 'Assiut', 'ar' => 'أسيوط'],
            ['en' => 'Sohag', 'ar' => 'سوهاج'],
            ['en' => 'Aswan', 'ar' => 'أسوان'],
            ['en' => 'Luxor', 'ar' => 'الأقصر'],
            ['en' => 'Red Sea', 'ar' => 'البحر الأحمر'],
            ['en' => 'New Valley', 'ar' => 'الوادي الجديد'],
            ['en' => 'Matrouh', 'ar' => 'مطروح'],
            ['en' => 'North Sinai', 'ar' => 'شمال سيناء'],
            ['en' => 'South Sinai', 'ar' => 'جنوب سيناء'],
            ['en' => 'Kafr El Sheikh', 'ar' => 'كفر الشيخ'],
            ['en' => 'Damietta', 'ar' => 'دمياط'],
        ];

        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead, to keep this seeder safe to run more than once.
        $existingEnNames = Governorate::all()
            ->map(fn (Governorate $governorate) => $governorate->getTranslation('name', 'en'))
            ->all();

        foreach ($governorates as $name) {
            if (in_array($name['en'], $existingEnNames, true)) {
                continue;
            }

            Governorate::create([
                'nationality_id' => $egypt->id,
                'name' => $name,
            ]);
        }
    }
}
