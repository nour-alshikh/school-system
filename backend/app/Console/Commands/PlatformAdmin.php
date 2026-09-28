<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * The only way to become a platform admin (docs/multi-tenancy.md, step 8)
 * — deliberately not something the web UI can grant.
 */
class PlatformAdmin extends Command
{
    protected $signature = 'platform:admin {email} {--revoke : Remove platform admin instead}';

    protected $description = 'Grant or revoke platform admin (create and suspend schools) for a user';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error('No user with that email.');

            return self::FAILURE;
        }

        $user->forceFill(['is_platform_admin' => ! $this->option('revoke')])->save();

        $this->info($user->is_platform_admin ? "{$user->email} is now a platform admin." : "{$user->email} is no longer a platform admin.");

        return self::SUCCESS;
    }
}
