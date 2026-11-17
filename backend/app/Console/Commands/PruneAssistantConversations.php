<?php

namespace App\Console\Commands;

use App\Models\AssistantConversation;
use Illuminate\Console\Command;

/**
 * Assistant chats are kept 30 days after their last message
 * (docs/ai-assistant-plan.md, phase 4). Scheduled daily in routes/console.php;
 * older ones are hidden from users even before this runs.
 */
class PruneAssistantConversations extends Command
{
    protected $signature = 'assistant:prune';

    protected $description = 'Delete assistant conversations untouched for 30 days';

    public function handle(): int
    {
        $deleted = AssistantConversation::withoutSchoolScope()->where('updated_at', '<', now()->subDays(AssistantConversation::KEEP_DAYS))->delete();

        $this->info("Deleted {$deleted} assistant conversations.");

        return self::SUCCESS;
    }
}
