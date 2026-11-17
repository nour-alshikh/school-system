<?php

namespace App\Services\Ai\Assistant;

/**
 * The assistant's read-only tools (config ai.assistant_tools), and which
 * of them a user may use. The prompt lists only those, but each tool's own
 * checks and scoping are what protect the data (rule 2).
 */
class AssistantTools
{
    /** @return array<string, Tool> name => tool, the ones this user may use */
    public function for(ToolContext $context): array
    {
        $tools = [];

        foreach (config('ai.assistant_tools', []) as $class) {
            $tool = app($class);
            if ($tool instanceof Tool && $tool->allows($context)) {
                $tools[$tool->name()] = $tool;
            }
        }

        return $tools;
    }
}
