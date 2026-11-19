<?php

namespace App\Demo;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Per-visitor copies of the demo data (docs/demo-sandboxes.md). A sandbox
 * is an SQLite file copied from the template plus its own folders on the
 * public and private disks, copied from the template's files. Activating
 * one points the default connection and both disks at it for the rest of
 * the request.
 */
class Sandboxes
{
    public const ID_PATTERN = '/^[a-f0-9]{32}$/';

    /** Touch a sandbox's file at most this often, not on every request. */
    private const TOUCH_SECONDS = 60;

    /** How often a request may prune expired sandboxes when no cron does it. */
    private const PRUNE_EVERY_SECONDS = 600;

    public static function validId(?string $id): bool
    {
        return is_string($id) && preg_match(self::ID_PATTERN, $id) === 1;
    }

    public function templateExists(): bool
    {
        return is_file(config('demo.template_path'));
    }

    public function exists(string $id): bool
    {
        return is_file($this->databasePath($id));
    }

    /** Creates the sandbox from the template if it's new (or was pruned), and uses it. */
    public function activate(string $id): void
    {
        if (! self::validId($id)) {
            throw new RuntimeException('Invalid sandbox id.');
        }

        $path = $this->databasePath($id);

        if (! is_file($path)) {
            $this->create($id);
        } elseif (time() - (int) filemtime($path) > self::TOUCH_SECONDS) {
            @touch($path);
        }

        $this->use($id);
    }

    /** Deletes one sandbox: its database and its files. */
    public function delete(string $id): void
    {
        if (! self::validId($id)) {
            return;
        }

        foreach (['', '-journal', '-wal', '-shm'] as $suffix) {
            @unlink($this->databasePath($id).$suffix);
        }

        File::deleteDirectory($this->filesPath('public', $id));
        File::deleteDirectory($this->filesPath('private', $id));
    }

    /**
     * Deletes sandboxes idle longer than demo.idle_minutes, then the
     * longest-idle ones past demo.max_sandboxes. Returns how many went.
     */
    public function prune(?int $keep = null): int
    {
        $files = collect(glob(config('demo.sandboxes_path').'/*.sqlite') ?: [])
            ->mapWithKeys(fn (string $file) => [basename($file, '.sqlite') => (int) filemtime($file)])
            ->filter(fn ($time, $id) => self::validId((string) $id))
            ->sort();

        $cutoff = time() - config('demo.idle_minutes') * 60;
        $expired = $files->filter(fn (int $time) => $time < $cutoff)->keys();

        $remaining = $files->except($expired->all());
        $limit = $keep ?? (int) config('demo.max_sandboxes');
        $overflow = $remaining->keys()->take(max(0, $remaining->count() - $limit));

        $doomed = $expired->merge($overflow);
        $doomed->each(fn ($id) => $this->delete((string) $id));

        return $doomed->count();
    }

    /** Every sandbox, for `demo:build --fresh`. */
    public function deleteAll(): int
    {
        $ids = collect(glob(config('demo.sandboxes_path').'/*.sqlite') ?: [])->map(fn ($file) => basename($file, '.sqlite'));
        $ids->each(fn ($id) => $this->delete($id));

        return $ids->count();
    }

    public function databasePath(string $id): string
    {
        return config('demo.sandboxes_path')."/{$id}.sqlite";
    }

    /** @param  'public'|'private'  $disk */
    public function filesPath(string $disk, string $id): string
    {
        return storage_path("app/{$disk}/demo/{$id}");
    }

    /**
     * Points the default (sqlite) connection at $databasePath and the
     * public and private disks at $publicRoot / $privateRoot. Also what
     * demo:build uses to seed the template.
     */
    public static function point(string $databasePath, string $publicRoot, string $publicUrl, string $privateRoot): void
    {
        $connection = config('database.default');

        config([
            "database.connections.{$connection}.database" => $databasePath,
            'filesystems.disks.public.root' => $publicRoot,
            'filesystems.disks.public.url' => $publicUrl,
            'filesystems.disks.local.root' => $privateRoot,
        ]);

        DB::purge($connection);

        // Anything already resolved keeps its old connection or root: the
        // database cache store holds the Connection it was made with, and
        // would write to the previous file.
        foreach (['filesystem', 'filesystem.disk', 'cache', 'cache.store'] as $binding) {
            app()->forgetInstance($binding);
        }
        Storage::clearResolvedInstance('filesystem');
        Cache::clearResolvedInstance('cache');
    }

    private function use(string $id): void
    {
        self::point(
            $this->databasePath($id),
            $this->filesPath('public', $id),
            rtrim((string) config('app.url'), '/')."/storage/demo/{$id}",
            $this->filesPath('private', $id),
        );
    }

    /**
     * Copy to a temporary name, then rename: two first requests at once
     * can't leave a half-copied file, and the second simply wins the rename.
     */
    private function create(string $id): void
    {
        if (! $this->templateExists()) {
            throw new RuntimeException('The demo template is missing: run `php artisan demo:build`.');
        }

        $this->pruneNowAndThen();

        File::ensureDirectoryExists(config('demo.sandboxes_path'));
        $path = $this->databasePath($id);
        $temporary = $path.'.'.bin2hex(random_bytes(4)).'.tmp';

        foreach (['public', 'private'] as $disk) {
            $from = config('demo.template_files')."/{$disk}";
            if (is_dir($from)) {
                File::copyDirectory($from, $this->filesPath($disk, $id));
            }
        }

        if (! copy(config('demo.template_path'), $temporary) || ! rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException("Couldn't create demo sandbox {$id}.");
        }
    }

    /**
     * Shared hosting may have no cron for `demo:prune`, so new sandboxes
     * prune too: at most every few minutes, and always when at the cap.
     */
    private function pruneNowAndThen(): void
    {
        $marker = config('demo.sandboxes_path').'/.pruned';
        $count = count(glob(config('demo.sandboxes_path').'/*.sqlite') ?: []);

        if ($count >= config('demo.max_sandboxes')) {
            $this->prune(max(0, (int) config('demo.max_sandboxes') - 1));
        } elseif (! is_file($marker) || time() - (int) filemtime($marker) > self::PRUNE_EVERY_SECONDS) {
            $this->prune();
        } else {
            return;
        }

        File::ensureDirectoryExists(dirname($marker));
        @touch($marker);
    }
}
