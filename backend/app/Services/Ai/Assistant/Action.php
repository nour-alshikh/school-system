<?php

namespace App\Services\Ai\Assistant;

/**
 * Something the assistant can propose doing (docs/ai-assistant-plan.md,
 * phase 6) — never does: the model's fields are validated and resolved
 * here (names → ids among what the user may use), and the chat shows a
 * confirm card. Confirm then calls the normal endpoint, or opens the normal
 * page pre-filled, as the user (rule 1).
 */
abstract class Action
{
    /** snake_case, as the model names it. */
    abstract public function name(): string;

    /** For the prompt: the fields and what it proposes, one line. */
    abstract public function describe(): string;

    /** Whether this user could do it themselves (permission, role, plan module). */
    abstract public function allows(ToolContext $context): bool;

    /** Laravel validation rules for the model's fields. */
    abstract public function rules(): array;

    /**
     * The proposal the card shows: resolved fields, plus warnings for what
     * couldn't be matched. Returns ['error' => '…'] when there's nothing
     * sensible to propose.
     *
     * @return array{fields: array, warnings?: list<string>}|array{error: string}
     */
    abstract public function prepare(ToolContext $context, array $fields): array;
}
