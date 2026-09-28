<?php

namespace Tests\Feature;

use App\Models\School;
use Database\Seeders\BackfillSchoolIdSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SchoolIdColumnTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_owned_tables_have_school_id_and_global_tables_do_not(): void
    {
        foreach (['stages', 'students', 'fee_payments', 'exam_attempt_answers', 'subject_stage', 'settings', 'media'] as $table) {
            $this->assertTrue(Schema::hasColumn($table, 'school_id'), "{$table} should have school_id");
        }

        foreach (['users', 'personal_access_tokens', 'roles', 'nationalities', 'religions', 'blood_types', 'governorates'] as $table) {
            $this->assertFalse(Schema::hasColumn($table, 'school_id'), "{$table} should stay global");
        }
    }

    public function test_seeder_backfills_school_owned_rows_but_not_user_media(): void
    {
        $school = School::first();

        $stageId = DB::table('stages')->insertGetId(['name' => '{"en":"Primary"}']);
        $userMediaId = $this->insertMedia('App\\Models\\User');
        $settingMediaId = $this->insertMedia('App\\Models\\Setting');

        $this->seed(BackfillSchoolIdSeeder::class);

        $this->assertSame($school->id, DB::table('stages')->where('id', $stageId)->value('school_id'));
        $this->assertSame($school->id, DB::table('media')->where('id', $settingMediaId)->value('school_id'));
        $this->assertNull(DB::table('media')->where('id', $userMediaId)->value('school_id'));
    }

    private function insertMedia(string $modelType): int
    {
        return DB::table('media')->insertGetId([
            'model_type' => $modelType,
            'model_id' => 1,
            'collection_name' => 'default',
            'name' => 'file',
            'file_name' => 'file.png',
            'disk' => 'public',
            'size' => 1,
            'manipulations' => '[]',
            'custom_properties' => '[]',
            'generated_conversions' => '[]',
            'responsive_images' => '[]',
        ]);
    }
}
