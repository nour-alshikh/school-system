<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

class Fee extends Model
{
    use BelongsToSchool;
    use HasTranslations;

    /**
     * Stored as a JSON object of locale => text, same convention as
     * Stage::$translatable.
     */
    public array $translatable = ['name'];

    protected $fillable = [
        'name',
        'academic_year_id',
        'amount',
        'is_active',
        'is_for_all',
        'stage_id',
        'grade_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_active' => 'boolean',
        'is_for_all' => 'boolean',
    ];

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function charges(): HasMany
    {
        return $this->hasMany(FeeCharge::class);
    }
}
