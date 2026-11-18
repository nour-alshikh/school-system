<?php

namespace App\TypeScript;

use Spatie\TypeScriptTransformer\Attributes\LiteralTypeScriptType;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * What an assistant answer proposes doing (docs/ai-assistant-plan.md,
 * phase 6), as its confirm card shows it. Fields per name are set by the
 * action classes in App\Services\Ai\Assistant\Actions.
 */
#[TypeScript]
final class AssistantActionType
{
    public function __construct(
        #[LiteralTypeScriptType("'create_event' | 'schedule_meeting' | 'draft_exam' | 'mark_attendance' | 'set_up_structure'")]
        public readonly string $name,
        #[LiteralTypeScriptType('Record<string, unknown>')]
        public readonly array $fields,
        /**
         * Codes for what couldn't be matched, "code" or "code:what was typed"
         * (classroom_not_found, student_ambiguous, zoom_not_connected, past_date …).
         *
         * @var string[]
         */
        public readonly array $warnings,
        #[LiteralTypeScriptType("'proposed' | 'done' | 'dismissed'")]
        public readonly string $status,
    ) {}

    public static function fromArray(array $action): self
    {
        return new self($action['name'], $action['fields'] ?? [], array_values($action['warnings'] ?? []), $action['status'] ?? 'proposed');
    }
}
