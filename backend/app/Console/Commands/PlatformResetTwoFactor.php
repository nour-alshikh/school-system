<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\TwoFactor;
use Illuminate\Console\Command;

/**
 * Recovery for a system admin who lost their authenticator app and their
 * recovery codes: they set 2FA up again at the next login. CLI only, like
 * platform:admin. See docs/central-dashboard-plan.md, phase 1.
 */
class PlatformResetTwoFactor extends Command
{
    protected $signature = 'platform:reset-2fa {email}';

    protected $description = 'Clear a system admin\'s two-factor setup so it is set up again at the next login';

    public function handle(TwoFactor $twoFactor): int
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error('No user with that email.');

            return self::FAILURE;
        }

        $twoFactor->reset($user);
        AuditLog::record('platform.two_factor_reset', $user, ['via' => 'cli'], platformWide: true);
        $this->info("Two-factor cleared for {$user->email}. They'll set it up again at their next system admin login.");

        return self::SUCCESS;
    }
}
