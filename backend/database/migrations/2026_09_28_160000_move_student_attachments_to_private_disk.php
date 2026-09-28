<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Student attachments (photos of children) were stored on the `public`
     * disk, reachable by anyone with the URL. Move them to the private
     * `local` disk; they're served by AttachmentController to signed-in
     * staff, the student and their parent only. Safe to re-run.
     */
    public function up(): void
    {
        $this->move(from: 'public', to: 'local');
    }

    public function down(): void
    {
        $this->move(from: 'local', to: 'public');
    }

    private function move(string $from, string $to): void
    {
        DB::table('media')
            ->where('model_type', 'App\Models\Student')
            ->where('collection_name', 'attachments')
            ->where('disk', $from)
            ->orderBy('id')
            ->each(function ($media) use ($from, $to) {
                // Same base folder as SchoolPathGenerator (conversions, if
                // any, are in subfolders of it).
                $folder = $media->school_id ? "schools/{$media->school_id}/{$media->id}" : (string) $media->id;
                $source = Storage::disk($from);
                $target = Storage::disk($to);

                foreach ($source->allFiles($folder) as $file) {
                    $target->writeStream($file, $source->readStream($file));
                }

                DB::table('media')->where('id', $media->id)->update(['disk' => $to, 'conversions_disk' => $to]);

                $source->deleteDirectory($folder);
            });
    }
};
