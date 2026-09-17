<?php

namespace App\TypeScript;

use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class AttachmentType
{
    public function __construct(
        public readonly int $id,
        public readonly string $url,
        public readonly string $name,
    ) {}

    public static function fromModel(Media $media): self
    {
        return new self(
            id: $media->id,
            url: $media->getUrl(),
            name: $media->file_name,
        );
    }
}
