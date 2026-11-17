<?php

namespace App\Services\Ai\Assistant;

/**
 * The assistant's read-only tools (config ai.assistant_tools) and the
 * actions it can propose (config ai.assistant_actions), and which of them
 * a user may use. The prompt lists only those, but each one's own checks
 * and scoping are what protect the data (rule 2).
 */
class AssistantTools
{
    /** @return array<string, Tool> name => tool, the ones this user may use */
    public function for(ToolContext $context): array
    {
        return $this->allowed(config('ai.assistant_tools', []), Tool::class, $context);
    }

    /** @return array<string, Action> name => action, the ones this user could do themselves */
    public function actions(ToolContext $context): array
    {
        return $this->allowed(config('ai.assistant_actions', []), Action::class, $context);
    }

    private function allowed(array $classes, string $base, ToolContext $context): array
    {
        $allowed = [];

        foreach ($classes as $class) {
            $item = app($class);
            if ($item instanceof $base && $item->allows($context)) {
                $allowed[$item->name()] = $item;
            }
        }

        return $allowed;
    }
}
