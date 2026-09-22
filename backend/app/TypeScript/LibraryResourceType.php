<?php

namespace App\TypeScript;

use App\Enums\LibraryResourceKind;
use App\Models\LibraryResource;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class LibraryResourceType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ?string $description,
        public readonly LibraryResourceKind $type,
        public readonly ?string $url,
        public readonly ?AttachmentType $file,
        public readonly int $grade_id,
        public readonly GradeType $grade,
        /** @var int[] */
        public readonly array $subject_ids,
        /** @var LibraryResourceSubjectType[] */
        public readonly array $subjects,
        public readonly PostAuthorType $uploader,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(LibraryResource $resource): self
    {
        $media = $resource->getFirstMedia('file');

        return new self(
            id: $resource->id,
            title: $resource->title,
            description: $resource->description,
            type: $resource->type,
            url: $resource->url,
            file: $media ? AttachmentType::fromModel($media) : null,
            grade_id: $resource->grade_id,
            grade: GradeType::fromModel($resource->grade),
            subject_ids: $resource->subjects->pluck('id')->all(),
            subjects: $resource->subjects->map(fn ($subject) => LibraryResourceSubjectType::fromModel($subject))->all(),
            uploader: PostAuthorType::fromModel($resource->uploader),
            created_at: $resource->created_at->toJSON(),
            updated_at: $resource->updated_at->toJSON(),
        );
    }
}
