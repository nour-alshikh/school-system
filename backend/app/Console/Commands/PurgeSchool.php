<?php

namespace App\Console\Commands;

use App\Models\School;
use App\Platform\SchoolLifecycle;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Permanently deletes an archived, exported school and everything that is
 * its own (docs/central-dashboard-plan.md, phase 7). CLI only, and you type
 * the school's slug to confirm: there is no undo.
 */
class PurgeSchool extends Command
{
    protected $signature = 'school:purge {id} {--confirm= : The school\'s slug, to confirm} {--now : Don\'t wait out the 30-day restore window}';

    protected $description = 'Permanently delete an archived school and all its data (after an export)';

    public function handle(SchoolLifecycle $lifecycle): int
    {
        $school = School::find($this->argument('id'));

        if (! $school) {
            $this->error('No school with that id.');

            return self::FAILURE;
        }

        if ($this->option('confirm') !== $school->slug) {
            $this->error("Type the school's slug to confirm: --confirm={$school->slug}");

            return self::FAILURE;
        }

        try {
            ['rows' => $rows, 'users' => $users] = $lifecycle->purge($school, (bool) $this->option('now'));
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Purged {$school->name}: {$rows} rows and {$users} accounts that belonged only to it. The audit log and exports were kept.");

        return self::SUCCESS;
    }
}
