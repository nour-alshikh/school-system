<?php

namespace Database\Seeders;

use App\Models\School;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * On a fresh install the school_id backfill migration runs before any
 * seeded rows exist, so this tags everything the other seeders created
 * with the default school. Discovers tables by their school_id column
 * rather than keeping its own list. Run last in DatabaseSeeder.
 *
 * Becomes unnecessary once models fill school_id themselves (step 3 of
 * docs/multi-tenancy.md).
 */
class BackfillSchoolIdSeeder extends Seeder
{
    public function run(): void
    {
        $schoolId = School::query()->oldest('id')->firstOrFail()->id;

        foreach (array_column(Schema::getTables(), 'name') as $name) {
            if (! Schema::hasColumn($name, 'school_id')) {
                continue;
            }

            DB::table($name)
                ->whereNull('school_id')
                // Avatars belong to global users, not a school.
                ->when($name === 'media', fn ($q) => $q->where('model_type', '!=', 'App\\Models\\User'))
                ->update(['school_id' => $schoolId]);
        }
    }
}
