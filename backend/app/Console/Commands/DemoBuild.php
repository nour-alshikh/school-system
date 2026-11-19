<?php

namespace App\Console\Commands;

use App\Demo\Sandboxes;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

/**
 * Builds the template every demo sandbox is copied from: a fresh SQLite
 * database migrated and seeded with the full demo data, and the files
 * the seed uploads. Built next to the old one and swapped in at the end,
 * so visitors keep working while it runs. See docs/demo-sandboxes.md.
 */
class DemoBuild extends Command
{
    protected $signature = 'demo:build {--fresh : Also delete every visitor\'s sandbox, so all start from the new data}';

    protected $description = 'Build the demo template database (and its files) that visitor sandboxes are copied from';

    public function handle(Sandboxes $sandboxes): int
    {
        if (config('database.default') !== 'sqlite') {
            $this->error('Demo sandboxes are SQLite files: set DB_CONNECTION=sqlite.');

            return self::FAILURE;
        }

        $template = config('demo.template_path');
        $files = config('demo.template_files');
        $build = dirname($template).'/build-'.date('YmdHis');

        File::ensureDirectoryExists($build);
        touch("{$build}/template.sqlite");

        Sandboxes::point("{$build}/template.sqlite", "{$build}/files/public", rtrim((string) config('app.url'), '/').'/storage', "{$build}/files/private");
        config(['demo.enabled' => true]);

        $this->info('Migrating and seeding the demo data…');
        $exit = Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true], $this->output);

        if ($exit !== self::SUCCESS) {
            File::deleteDirectory($build);
            $this->error('Seeding failed; the old template is unchanged.');

            return self::FAILURE;
        }

        // Swap: the database first, then the files. Copied next to the
        // template and renamed over it (atomic), rather than moved: Windows
        // won't move a file this process may still have open.
        DB::disconnect();
        copy("{$build}/template.sqlite", "{$template}.new");
        rename("{$template}.new", $template);
        File::deleteDirectory($files);
        File::ensureDirectoryExists("{$build}/files");
        rename("{$build}/files", $files);
        File::deleteDirectory($build);

        $this->info("Template ready: {$template}");

        if ($this->option('fresh')) {
            $this->info('Deleted '.$sandboxes->deleteAll().' sandbox(es).');
        }

        return self::SUCCESS;
    }
}
