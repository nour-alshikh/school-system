<?php

namespace App\Services\Ai\Assistant;

/**
 * A read-only lookup the assistant can ask for (docs/ai-assistant-plan.md,
 * phase 5): a thin wrapper over the same queries and checks as the page it
 * mirrors, returning a small summary. Args are validated like a request;
 * the result goes back to the model as data.
 */
abstract class Tool
{
    /** snake_case, as the model names it. */
    abstract public function name(): string;

    /** For the prompt: the args and what it returns, one line. */
    abstract public function describe(): string;

    /** Whether this user may use it at all (role, permission, plan module). */
    abstract public function allows(ToolContext $context): bool;

    /** Laravel validation rules for the args. */
    public function rules(): array
    {
        return [];
    }

    /**
     * Runs as the user. Returns plain data for the model; may include
     * "links" => [{href, label}] the answer can point to.
     */
    abstract public function run(ToolContext $context, array $args): array;
}
