<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Translatable\HasTranslations;

class Subject extends Model
{
    use HasTranslations;

    /**
     * Stored as a JSON object of locale => text, same convention as
     * Stage::$translatable.
     */
    public array $translatable = ['name'];

    protected $fillable = [
        'name',
    ];

    /**
     * The stages this subject is taught across (every grade under them). A
     * subject is validated to have exactly one of stages()/grades() —
     * whichever scope the admin picked — never both. See
     * Store/UpdateSubjectRequest.
     */
    public function stages(): BelongsToMany
    {
        return $this->belongsToMany(Stage::class, 'subject_stage');
    }

    public function grades(): BelongsToMany
    {
        return $this->belongsToMany(Grade::class, 'subject_grade');
    }

    public function teachers(): BelongsToMany
    {
        return $this->belongsToMany(Teacher::class);
    }
}
