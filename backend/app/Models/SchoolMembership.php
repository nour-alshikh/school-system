<?php

namespace App\Models;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Links a global user to a school with a role. Never deleted on transfer —
 * status flips to 'left' so historical records keep a real membership.
 */
class SchoolMembership extends Model
{
    protected $fillable = [
        'user_id',
        'school_id',
        'role',
        'status',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'role' => MembershipRole::class,
        'status' => MembershipStatus::class,
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
        // Set by ResolveSchool, at most every 5 minutes (central dashboard, phase 3).
        'last_seen_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function scopeActive(Builder $query): void
    {
        $query->where('status', MembershipStatus::Active);
    }
}
