<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A school's plan: how many students, how much storage, which modules
 * (docs/central-dashboard-plan.md, phase 9). Null limits mean none.
 */
class Plan extends Model
{
    /** Modules a plan can include, and the only ones EnforcePlanFeatures knows. */
    public const FEATURES = ['fees', 'exams', 'meetings', 'library'];

    protected $fillable = ['key', 'name', 'max_students', 'max_storage_mb', 'features'];

    protected $casts = [
        'max_students' => 'integer',
        'max_storage_mb' => 'integer',
        'features' => 'array',
    ];

    public function schools(): HasMany
    {
        return $this->hasMany(School::class);
    }

    public function includes(string $feature): bool
    {
        return in_array($feature, $this->features ?? [], true);
    }

    /** For a school with no plan set (shouldn't happen after the migration). */
    public static function unlimited(): self
    {
        return static::where('key', 'unlimited')->first() ?? new static(['key' => 'unlimited', 'name' => 'Unlimited', 'features' => self::FEATURES]);
    }
}
