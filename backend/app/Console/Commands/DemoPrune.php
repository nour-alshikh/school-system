<?php

namespace App\Console\Commands;

use App\Demo\Sandboxes;
use Illuminate\Console\Command;

/** Deletes visitors' demo sandboxes that have been idle too long (docs/demo-sandboxes.md). */
class DemoPrune extends Command
{
    protected $signature = 'demo:prune';

    protected $description = 'Delete idle demo sandboxes (config demo.idle_minutes)';

    public function handle(Sandboxes $sandboxes): int
    {
        $this->info('Deleted '.$sandboxes->prune().' idle sandbox(es).');

        return self::SUCCESS;
    }
}
