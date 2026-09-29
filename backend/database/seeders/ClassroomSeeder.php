<?php

namespace Database\Seeders;

use App\Services\SchoolStructureTemplate;
use Illuminate\Database\Seeder;

class ClassroomSeeder extends Seeder
{
    /** Three sections per grade; a new school's quick start makes one. */
    public function run(): void
    {
        app(SchoolStructureTemplate::class)->createClassrooms(['A', 'B', 'C']);
    }
}
