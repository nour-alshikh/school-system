<?php

namespace App\TypeScript;

use App\Models\Meeting;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * A student only ever gets join_url — start_url is the host-only Zoom
 * control link, see MeetingType/ZoomService. Separate class rather than a
 * conditional field, same convention as StudentExamOptionType hiding
 * is_correct from ExamQuestionOptionType.
 */
#[TypeScript]
final class StudentMeetingType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ?string $description,
        public readonly string $start_time,
        public readonly int $duration_minutes,
        public readonly string $join_url,
        public readonly string $teacher_name,
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
            teacher_name: $meeting->creator->name,
        );
    }
}
