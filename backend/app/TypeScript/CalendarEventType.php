<?php

namespace App\TypeScript;

use App\Models\CalendarEvent;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class CalendarEventType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ?string $description,
        public readonly string $date,
        public readonly string $created_by_name,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(CalendarEvent $event): self
    {
        return new self(
            id: $event->id,
            title: $event->title,
            description: $event->description,
            date: $event->date->toDateString(),
            created_by_name: $event->creator->name,
            created_at: $event->created_at->toJSON(),
            updated_at: $event->updated_at->toJSON(),
        );
    }
}
