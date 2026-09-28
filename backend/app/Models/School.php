<?php

namespace App\Models;

use App\Enums\SchoolStatus;
use Illuminate\Database\Eloquent\Model;
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
    ];

    protected $casts = [
        'status' => SchoolStatus::class,
    ];

    // Mirrors the column default, so a just-created school has it in memory.
    protected $attributes = [
        'status' => 'active',
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
}
