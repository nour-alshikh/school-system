<?php

namespace Database\Seeders;

use App\Models\Nationality;
use Illuminate\Database\Seeder;

class NationalitySeeder extends Seeder
{
    /**
     * Only "Egyptian" is seeded — nationality is fixed to Egypt across the
     * app (see GovernorateSeeder, which links every governorate to this
     * row). The table still exists as a real FK target rather than a
     * hardcoded string, in case that ever changes.
     */
    public function run(): void
    {
        // name is a JSON column (HasTranslations), so there's no unique
        // column to key firstOrCreate off of — check the English name in
        // PHP instead, to keep this seeder safe to run more than once.
        $alreadyExists = Nationality::all()
            ->contains(fn (Nationality $nationality) => $nationality->getTranslation('name', 'en') === 'Egyptian');

        if (! $alreadyExists) {
            Nationality::create(['name' => ['en' => 'Egyptian', 'ar' => 'مصري']]);
        }
    }
}
