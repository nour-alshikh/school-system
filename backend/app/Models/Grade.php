<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

class Grade extends Model
{
    use BelongsToSchool;
    use HasTranslations;

    /**
     * Stored as a JSON object of locale => text, same convention as
     * Stage::$translatable.
     */
    public array $translatable = ['name'];

    protected $fillable = [
        'stage_id',
        'name',
    ];

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function classrooms(): HasMany
    {
        return $this->hasMany(Classroom::class);
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToManyInSchool(Subject::class, 'subject_grade');
    }
}
