<?php

namespace App\Models;

use App\Platform\PlanLimits;
use Spatie\MediaLibrary\MediaCollections\Models\Media as BaseMedia;

/**
 * Registered as media-library's media_model. Copies school_id from the
 * owning model, so a student's or setting's files belong to that school
 * while a (global) user's avatar keeps school_id null. A school's files
 * count against its plan's storage (docs/central-dashboard-plan.md,
 * phase 9): refused here, before the file is copied into place.
 */
class Media extends BaseMedia
{
    protected static function booted(): void
    {
        static::creating(function (self $media) {
            $media->school_id ??= $media->model?->getAttribute('school_id');

            if ($media->school_id !== null && ($school = School::find($media->school_id))) {
                app(PlanLimits::class)->ensureRoomForFile($school, (int) $media->size);
            }
        });
    }
}
