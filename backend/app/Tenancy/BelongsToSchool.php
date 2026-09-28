<?php

namespace App\Tenancy;

use App\Models\School;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * For every model whose table has school_id: reads are limited to the
 * current school (so route-model binding 404s on another school's record),
 * and school_id is filled on create. With no current school set, both
 * throw MissingSchoolContext instead of spanning every school.
 */
trait BelongsToSchool
{
    public static function bootBelongsToSchool(): void
    {
        static::addGlobalScope(new SchoolScope);

        static::creating(function (self $model) {
            $model->school_id ??= app(TenantContext::class)->id();
        });
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /**
     * belongsToMany() for a pivot table that has school_id: attach()/sync()
     * write the current school into the pivot row, and reads only match
     * pivot rows of the current school.
     */
    public function belongsToManyInSchool(string $related, ?string $table = null): BelongsToMany
    {
        return $this->belongsToMany($related, $table)
            ->withPivotValue('school_id', app(TenantContext::class)->id());
    }

    /**
     * The one sanctioned way to read across schools. Keep call sites rare
     * and obvious.
     */
    public static function withoutSchoolScope(): Builder
    {
        return static::withoutGlobalScope(SchoolScope::class);
    }
}
