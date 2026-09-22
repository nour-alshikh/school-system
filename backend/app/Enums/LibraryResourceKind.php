<?php

namespace App\Enums;

/**
 * Named Kind rather than Type to avoid colliding with the generated TS
 * response shape LibraryResourceType (App\TypeScript\LibraryResourceType) —
 * spatie/laravel-typescript-transformer emits both into one flat file, so
 * two PHP classes in different namespaces sharing a name still collide
 * there.
 */
enum LibraryResourceKind: string
{
    case File = 'file';
    case Link = 'link';
}
