<?php

namespace App\TypeScript;

use App\Models\AssistantConversation;
use App\Models\AssistantMessage;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/** A chat with the assistant and its turns, oldest first. */
#[TypeScript]
final class AssistantConversationType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        /** @var AssistantMessageType[] */
        public readonly array $messages,
    ) {}

    public static function fromModel(AssistantConversation $conversation): self
    {
        return new self(
            id: $conversation->id,
            title: $conversation->title,
            messages: $conversation->messages->map(fn (AssistantMessage $m) => AssistantMessageType::fromModel($m))->all(),
        );
    }
}
