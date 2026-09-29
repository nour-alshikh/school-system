<?php

namespace App\Models;

use App\Enums\SchoolSource;
use App\Enums\SchoolStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The tenant. See docs/multi-tenancy.md.
 */
class School extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'status',
        'status_reason',
        'archived_at',
        'created_by_id',
        'source',
        'plan_id',
    ];

    protected $casts = [
        'status' => SchoolStatus::class,
        'source' => SchoolSource::class,
        'archived_at' => 'datetime',
    ];

    // Mirrors the column defaults, so a just-created school has them in memory.
    protected $attributes = [
        'status' => 'active',
        'source' => 'platform',
    ];

    public function memberships(): HasMany
    {
        return $this->hasMany(SchoolMembership::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'school_memberships')
            ->withPivot(['role', 'status'])
            ->withTimestamps();
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    /** Its plan, or Unlimited when none is set. */
    public function effectivePlan(): Plan
    {
        return $this->plan ?? Plan::unlimited();
    }

    /** Whoever created it through self-service; null for platform/seeded schools. */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}
