<?php

namespace App\Tenancy;

use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\DatabasePresenceVerifier;

/**
 * Makes every `exists:` / `unique:` validation rule on a school-owned table
 * check only the current school — so a grade_id from another school fails
 * validation instead of being accepted. Covers all FormRequests without
 * editing each rule.
 */
class SchoolScopedPresenceVerifier extends DatabasePresenceVerifier
{
    /** @var array<string, bool> */
    private static array $schoolOwned = [];

    protected function table($table)
    {
        $query = parent::table($table);

        // Media keeps null school_id for user avatars; nothing validates
        // against it, so leave it unscoped rather than special-case it.
        if ($table !== 'media' && $this->isSchoolOwned($table)) {
            $query->where("{$table}.school_id", app(TenantContext::class)->id());
        }

        return $query;
    }

    private function isSchoolOwned(string $table): bool
    {
        return self::$schoolOwned[$table] ??= Schema::connection($this->connection)->hasColumn($table, 'school_id');
    }
}
