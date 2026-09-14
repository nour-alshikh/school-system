<?php

namespace App\Models;

use App\Enums\PostCategory;
use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Translatable\HasTranslations;

class Post extends Model
{
    use HasFactory;
    use HasTranslations;

    /**
     * Stored as a JSON object of locale => text (see SetLocale middleware —
     * reads/writes always go through the request's current App::getLocale(),
     * so a plain `$post->title = '...'` or `$post->title` reads/writes just
     * the active locale's copy, not the whole translation set).
     */
    public array $translatable = ['title', 'body'];

    protected $fillable = [
        'title',
        'body',
        'status',
        'category',
        'tags',
        'is_featured',
        'reading_minutes',
        'priority',
        'published_at',
    ];

    protected $casts = [
        'status' => PostStatus::class,
        'category' => PostCategory::class,
        'tags' => 'array',
        'is_featured' => 'boolean',
        'reading_minutes' => 'integer',
        'priority' => 'integer',
        'published_at' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
