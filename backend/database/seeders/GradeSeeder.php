<?php

namespace Database\Seeders;

use App\Services\SchoolStructureTemplate;
use Illuminate\Database\Seeder;

class GradeSeeder extends Seeder
{
    /** The data lives in SchoolStructureTemplate, shared with new schools' quick start. */
    public function run(): void
    {
        app(SchoolStructureTemplate::class)->createGrades();
    }
}
