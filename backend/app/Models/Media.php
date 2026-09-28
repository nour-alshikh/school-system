<?php

namespace App\Models;

use Spatie\MediaLibrary\MediaCollections\Models\Media as BaseMedia;

/**
 * Registered as media-library's media_model. Copies school_id from the
 * owning model, so a student's or setting's files belong to that school
 * while a (global) user's avatar keeps school_id null.
 */
class Media extends BaseMedia
{
    protected static function booted(): void
    {
        static::creating(function (self $media) {
            $media->school_id ??= $media->model?->getAttribute('school_id');
        });
    }
}
