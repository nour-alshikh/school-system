<?php

namespace App\Models;

use App\Enums\AnnouncementLevel;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Translatable\HasTranslations;

/**
 * A message from the system admin, shown as a banner to everyone it's for
 * (docs/central-dashboard-plan.md, phase 8). Platform-level, not
 * BelongsToSchool: school_id null means every school.
 */
class Announcement extends Model
{
    use HasTranslations;

    public array $translatable = ['title', 'body'];

    protected $fillable = ['title', 'body', 'level', 'school_id', 'audience', 'starts_at', 'ends_at', 'created_by'];

    protected $casts = [
        'level' => AnnouncementLevel::class,
        'audience' => 'array',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function dismissedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'announcement_dismissals')->withPivot('created_at');
    }

    /** Started and not ended. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('starts_at', '<=', now())
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', now()));
    }

    /** For $schoolId (or every school) and someone with $role. */
    public function scopeFor(Builder $query, int $schoolId, string $role): Builder
    {
        return $query->where(fn ($q) => $q->whereNull('school_id')->orWhere('school_id', $schoolId))
            ->where(fn ($q) => $q->whereNull('audience')->orWhereJsonContains('audience', $role));
    }
}
