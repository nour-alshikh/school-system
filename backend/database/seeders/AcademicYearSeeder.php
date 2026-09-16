<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use Illuminate\Database\Seeder;

class AcademicYearSeeder extends Seeder
{
    public function run(): void
    {
        $years = [
            ['year' => 2024, 'is_current' => false],
            ['year' => 2025, 'is_current' => true],
        ];

        foreach ($years as $row) {
            AcademicYear::firstOrCreate(['year' => $row['year']], $row);
        }
    }
}
