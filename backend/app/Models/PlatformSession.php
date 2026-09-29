<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A system admin working inside a school as its admin
 * (docs/central-dashboard-plan.md, phase 5). Platform-level, not
 * BelongsToSchool: it's how someone outside the school gets in.
 */
class PlatformSession extends Model
{
    /** How long a session lasts before the system admin has to enter again. */
    public const HOURS = 2;

    protected $fillable = ['user_id', 'school_id', 'reason', 'started_at', 'expires_at', 'ended_at'];

    protected $casts = [
        'started_at' => 'datetime',
        'expires_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function isOpen(): bool
    {
        return $this->ended_at === null && $this->expires_at->isFuture();
    }
}
