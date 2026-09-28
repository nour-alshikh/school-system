<?php

namespace App\Tenancy;

use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\MediaLibrary\Support\PathGenerator\DefaultPathGenerator;

/**
 * media-library's path_generator: a school's files live under
 * schools/{school_id}/{media_id}/ so each school's files can be listed,
 * exported or deleted as one folder. Media of global users (avatars, no
 * school_id) keeps the default {media_id}/ path.
 */
class SchoolPathGenerator extends DefaultPathGenerator
{
    protected function getBasePath(Media $media): string
    {
        $base = parent::getBasePath($media);

        return $media->school_id ? "schools/{$media->school_id}/{$base}" : $base;
    }
}
