<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A zip of one school's data and files, downloadable for 24 hours
 * (docs/central-dashboard-plan.md, phase 7). Platform-level, not
 * BelongsToSchool, and kept after the school is purged.
 */
class SchoolExport extends Model
{
    public const HOURS = 24;

    protected $fillable = ['school_id', 'created_by', 'path', 'size', 'expires_at'];

    protected $casts = ['expires_at' => 'datetime'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
