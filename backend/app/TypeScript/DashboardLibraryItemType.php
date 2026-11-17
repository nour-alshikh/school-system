<?php

namespace App\TypeScript;

use App\Enums\LibraryResourceKind;
use App\Models\LibraryResource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A library resource on the student dashboard: newest for their grade. The app has no book loans. */
#[TypeScript]
final class DashboardLibraryItemType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly LibraryResourceKind $type,
        public readonly string $created_at,
    ) {}

    public static function fromModel(LibraryResource $resource): self
    {
        return new self($resource->id, $resource->title, $resource->type, $resource->created_at->toJSON());
    }
}
