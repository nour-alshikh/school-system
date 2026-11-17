<?php

namespace App\TypeScript;

use App\Models\AssistantMessage;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A turn in a chat with the assistant (docs/ai-assistant-plan.md, phase 4). */
#[TypeScript]
final class AssistantMessageType
{
    public function __construct(
        public readonly int $id,
        /** user | assistant */
        public readonly string $role,
        public readonly string $content,
        /**
         * Pages the answer points to: from the user's navigation, or a
         * lookup's result (a student's page).
         *
         * @var AssistantLinkType[]
         */
        public readonly array $links,
        public readonly string $created_at,
    ) {}

    public static function fromModel(AssistantMessage $message): self
    {
        return new self(
            id: $message->id,
            role: $message->role,
            content: $message->content,
            // Phase 4 stored bare paths; the frontend names those from its nav.
            links: array_map(
                fn ($link) => is_array($link) ? new AssistantLinkType($link['href'], $link['label'] ?? '') : new AssistantLinkType($link, ''),
                array_values($message->links ?? []),
            ),
            created_at: $message->created_at->toJSON(),
        );
    }
}
