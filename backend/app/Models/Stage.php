<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Translatable\HasTranslations;

class Stage extends Model
{
    use HasTranslations;

    /**
     * Stored as a JSON object of locale => text. Unlike Post::$translatable
     * (which reads/writes only the current request locale), Stage's admin
     * form submits both locales at once — assigning an associative array to
     * a translatable attribute (spatie/laravel-translatable) sets every
     * locale's translation in one go instead of just the active one.
     */
    public array $translatable = ['name'];

    protected $fillable = [
        'name',
    ];
}
