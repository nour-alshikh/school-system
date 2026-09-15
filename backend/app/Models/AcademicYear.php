<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Translatable\HasTranslations;

class AcademicYear extends Model
{
    use HasTranslations;

    /**
     * Stored as a JSON object of locale => text, same convention as
     * Stage::$translatable.
     */
    public array $translatable = ['name'];

    protected $fillable = [
        'name',
        'is_current',
    ];

    protected $casts = [
        'is_current' => 'boolean',
    ];

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }
}
