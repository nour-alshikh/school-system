<?php

namespace Database\Seeders;

use App\Models\Classroom;
use App\Models\Grade;
use Illuminate\Database\Seeder;

class ClassroomSeeder extends Seeder
{
    public function run(): void
    {
        $sections = ['A', 'B', 'C'];

        Grade::all()->each(function (Grade $grade) use ($sections) {
            $gradeName = $grade->getTranslation('name', 'en');

            $existingNames = $grade->classrooms()->pluck('name')->all();

            foreach ($sections as $section) {
                $name = "{$gradeName} - {$section}";

                if (in_array($name, $existingNames, true)) {
                    continue;
                }

                Classroom::create([
                    'grade_id' => $grade->id,
                    'name' => $name,
                    'capacity' => 30,
                ]);
            }
        });
    }
}
