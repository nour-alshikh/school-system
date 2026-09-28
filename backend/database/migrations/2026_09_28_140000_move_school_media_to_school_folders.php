<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Step 7 of docs/multi-tenancy.md: SchoolPathGenerator now looks for a
     * school's files under schools/{school_id}/{media_id}/ instead of
     * {media_id}/. Move files uploaded before that, so they keep resolving.
     * Safe to re-run: a folder that isn't at the old path is skipped.
     */
    public function up(): void
    {
        $this->moveAll(fn ($m) => "{$m->id}", fn ($m) => "schools/{$m->school_id}/{$m->id}");
    }

    public function down(): void
    {
        $this->moveAll(fn ($m) => "schools/{$m->school_id}/{$m->id}", fn ($m) => "{$m->id}");
    }

    private function moveAll(Closure $from, Closure $to): void
    {
        DB::table('media')
            ->whereNotNull('school_id')
            ->orderBy('id')
            ->each(function ($media) use ($from, $to) {
                // Conversions and responsive images live in subfolders of the
                // same base folder, possibly on a separate conversions disk.
                foreach (array_unique(array_filter([$media->disk, $media->conversions_disk])) as $disk) {
                    $this->moveFolder(Storage::disk($disk), $from($media), $to($media));
                }
            });
    }

    private function moveFolder($disk, string $from, string $to): void
    {
        foreach ($disk->allFiles($from) as $file) {
            $disk->move($file, $to.substr($file, strlen($from)));
        }

        if ($disk->directoryExists($from)) {
            $disk->deleteDirectory($from);
        }
    }
};
