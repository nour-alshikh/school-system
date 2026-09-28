<?php

namespace Tests\Feature;

use App\Models\School;
use App\Models\Setting;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Step 7 of docs/multi-tenancy.md: jobs run as the school that dispatched
 * them, and a school's files live under schools/{school_id}/.
 */
class SchoolQueueAndMediaTest extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;

    private School $schoolB;

    private TenantContext $context;

    protected function setUp(): void
    {
        parent::setUp();

        $this->schoolA = School::query()->oldest('id')->firstOrFail();
        $this->schoolB = School::create(['name' => 'Second School', 'slug' => 'second-school']);
        $this->context = app(TenantContext::class);
    }

    public function test_queued_job_runs_as_the_school_that_dispatched_it(): void
    {
        $this->context->runAs($this->schoolB, function () {
            dispatch(fn () => Cache::put('job_school', app(TenantContext::class)->id()))
                ->onConnection('database');
        });

        // The worker starts with no school, like a real queue:work process.
        $this->context->clear();
        $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--stop-when-empty' => true]);

        $this->assertSame($this->schoolB->id, Cache::get('job_school'));
        $this->assertFalse($this->context->has());
    }

    public function test_sync_job_restores_the_dispatching_requests_school(): void
    {
        $this->context->set($this->schoolA);

        dispatch_sync(fn () => Cache::put('job_school', app(TenantContext::class)->id()));

        $this->assertSame($this->schoolA->id, Cache::get('job_school'));
        $this->assertSame($this->schoolA->id, $this->context->id());
    }

    public function test_job_dispatched_without_a_school_runs_without_one(): void
    {
        dispatch(fn () => Cache::put('job_has_school', app(TenantContext::class)->has()))
            ->onConnection('database');

        $this->context->set($this->schoolA);
        $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--stop-when-empty' => true]);

        $this->assertFalse(Cache::get('job_has_school'));
    }

    public function test_school_media_is_stored_under_the_schools_folder(): void
    {
        Storage::fake('public');

        $media = $this->context->runAs($this->schoolB, function () {
            $setting = Setting::create(['key' => 'logo', 'group' => 'branding']);

            return $setting->addMedia(UploadedFile::fake()->image('logo.png'))->toMediaCollection('file');
        });

        $this->assertSame($this->schoolB->id, $media->school_id);
        $this->assertSame("schools/{$this->schoolB->id}/{$media->id}/logo.png", $media->getPathRelativeToRoot());
        Storage::disk('public')->assertExists($media->getPathRelativeToRoot());
    }

    public function test_user_avatar_keeps_the_default_path(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();

        $media = $user->addMedia(UploadedFile::fake()->image('me.png'))->toMediaCollection('avatar');

        $this->assertNull($media->school_id);
        $this->assertSame("{$media->id}/me.png", $media->getPathRelativeToRoot());
    }

    public function test_migration_moves_existing_files_into_school_folders(): void
    {
        Storage::fake('public');
        $media = $this->context->runAs($this->schoolA, function () {
            $setting = Setting::create(['key' => 'logo', 'group' => 'branding']);

            return $setting->addMedia(UploadedFile::fake()->image('logo.png'))->toMediaCollection('file');
        });
        $new = $media->getPathRelativeToRoot();
        $old = "{$media->id}/logo.png";

        // Put the file where it lived before step 7.
        Storage::disk('public')->move($new, $old);

        $migration = require database_path('migrations/2026_09_28_140000_move_school_media_to_school_folders.php');
        $migration->up();

        Storage::disk('public')->assertExists($new);
        Storage::disk('public')->assertMissing($old);

        $migration->down();
        Storage::disk('public')->assertExists($old);
        Storage::disk('public')->assertMissing($new);
    }
}
