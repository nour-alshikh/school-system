<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
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

        // `roles` has a nullable school_id (spatie teams) but every role is
        // global (null); assignments carry the school instead.
        foreach (['users', 'personal_access_tokens', 'nationalities', 'religions', 'blood_types', 'governorates'] as $table) {
            $this->assertFalse(Schema::hasColumn($table, 'school_id'), "{$table} should stay global");
        }
    }
}
