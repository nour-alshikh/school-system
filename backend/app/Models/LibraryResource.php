<?php

namespace App\Models;

use App\Enums\LibraryResourceKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class LibraryResource extends Model implements HasMedia
{
    use InteractsWithMedia;

    protected $fillable = [
        'title',
        'description',
        'type',
        'url',
        'grade_id',
        'uploaded_by',
    ];

    protected $casts = [
        'type' => LibraryResourceKind::class,
    ];

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    /**
     * Subject tags — 0+ per resource, unlike Subject::stages()/grades()
     * which are mutually exclusive scopes. See
     * StoreLibraryResourceRequest.
     */
    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class, 'library_resource_subject');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('file')->singleFile();
    }
}
