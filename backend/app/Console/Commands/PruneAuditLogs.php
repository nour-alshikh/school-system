<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use Illuminate\Console\Command;

/**
 * Audit entries are kept two years (docs/central-dashboard-plan.md, phase
 * 2). Meant to run monthly once a scheduler exists (see docs/gaps.md).
 */
class PruneAuditLogs extends Command
{
    protected $signature = 'audit:prune {--years=2 : Keep entries this many years}';

    protected $description = 'Delete audit log entries older than the retention period';

    public function handle(): int
    {
        $deleted = AuditLog::where('created_at', '<', now()->subYears((int) $this->option('years')))->delete();

        $this->info("Deleted {$deleted} audit log entries.");

        return self::SUCCESS;
    }
}
