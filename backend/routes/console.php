<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Needs `php artisan schedule:run` every minute (cron) in production.
if (config('demo.enabled')) {
    // A demo deployment's data lives in short-lived per-visitor copies
    // (docs/demo-sandboxes.md); the default connection is the template,
    // which nothing should change.
    Schedule::command('demo:prune')->everyFifteenMinutes();
} else {
    Schedule::command('assistant:prune')->daily();
}
