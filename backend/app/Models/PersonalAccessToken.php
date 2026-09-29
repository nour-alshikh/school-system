<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

/**
 * Sanctum's token, plus the membership (school + role) it was issued for —
 * or, for a system admin inside a school, the platform session. Registered
 * in AppServiceProvider. See docs/multi-tenancy.md and
 * docs/central-dashboard-plan.md (phase 5).
 */
class PersonalAccessToken extends SanctumPersonalAccessToken
{
    protected $casts = [
        'abilities' => 'json',
        'last_used_at' => 'datetime',
        'expires_at' => 'datetime',
        'platform_confirmed_at' => 'datetime',
    ];

    public function membership(): BelongsTo
    {
        return $this->belongsTo(SchoolMembership::class, 'school_membership_id');
    }

    public function platformSession(): BelongsTo
    {
        return $this->belongsTo(PlatformSession::class);
    }
}
