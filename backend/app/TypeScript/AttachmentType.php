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
            // Relative on purpose: the browser loads it through the frontend
            // BFF, which adds the signed-in user's token. The file itself is on
            // a private disk (see AttachmentController).
            url: "/api/attachments/{$media->id}",
            name: $media->file_name,
        );
    }
}
