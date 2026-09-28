<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * Sanctum's token, plus the membership (school + role) it was issued for.
 * Registered in AppServiceProvider. See docs/multi-tenancy.md.
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    public function membership(): BelongsTo
    {
        return $this->belongsTo(SchoolMembership::class, 'school_membership_id');
    }
}
