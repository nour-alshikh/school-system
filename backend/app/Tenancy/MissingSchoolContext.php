<?php

namespace App\Tenancy;

use RuntimeException;

/**
 * Thrown when school-owned data is touched with no current school set.
 * Deliberately loud: the alternative is a query that silently spans every
 * school. Fix the caller (set TenantContext), don't catch this.
 */
class MissingSchoolContext extends RuntimeException
{
    public static function make(): self
    {
        return new self('No current school is set. Set App\Tenancy\TenantContext before touching school-owned data.');
    }
}
