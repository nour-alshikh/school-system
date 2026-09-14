<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Translatable\HasTranslations;

class Grade extends Model
{
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
}
