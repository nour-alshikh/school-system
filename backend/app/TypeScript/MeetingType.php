<?php

namespace App\TypeScript;

use App\Models\Meeting;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The teacher/admin view of a meeting — includes start_url (the host-only
 * Zoom control link). See StudentMeetingType for the version students get,
 * which drops it.
 */
#[TypeScript]
final class MeetingType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ?string $description,
        public readonly string $start_time,
        public readonly int $duration_minutes,
        public readonly string $join_url,
        public readonly string $start_url,
        public readonly int $created_by,
        public readonly string $creator_name,
        /** @var MeetingClassroomType[] */
        public readonly array $classrooms,
    ) {}

    public static function fromModel(Meeting $meeting): self
    {
        return new self(
            id: $meeting->id,
            title: $meeting->title,
            description: $meeting->description,
            start_time: $meeting->start_time->toJSON(),
            duration_minutes: $meeting->duration_minutes,
            join_url: $meeting->join_url,
            start_url: $meeting->start_url,
            created_by: $meeting->created_by,
            creator_name: $meeting->creator->name,
            classrooms: $meeting->classrooms->map(fn ($classroom) => MeetingClassroomType::fromModel($classroom))->all(),
        );
    }
}
