<?php

namespace Tests\Feature;

use App\Demo\Sandboxes;
use App\Http\Middleware\UseDemoSandbox;
use App\Models\Plan;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * docs/demo-sandboxes.md: every demo visitor works on their own copy of
 * the template, which nothing changes.
 */
class DemoSandboxTest extends TestCase
{
    private const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    private const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    private string $root;

    protected function setUp(): void
    {
        parent::setUp();

        $this->root = storage_path('framework/testing/demo');
        File::deleteDirectory($this->root);

        config([
            'demo.enabled' => true,
            'demo.template_path' => "{$this->root}/template.sqlite",
            'demo.template_files' => "{$this->root}/template-files",
            'demo.sandboxes_path' => "{$this->root}/sandboxes",
        ]);

        // A small template: the schema (plans come from a migration) and one file.
        File::ensureDirectoryExists($this->root);
        touch(config('demo.template_path'));
        Sandboxes::point(config('demo.template_path'), "{$this->root}/template-files/public", 'http://localhost/storage', "{$this->root}/template-files/private");
        Artisan::call('migrate', ['--force' => true]);
        Storage::disk('public')->put('logo.txt', 'template');
        DB::disconnect();
    }

    protected function tearDown(): void
    {
        DB::disconnect();
        File::deleteDirectory($this->root);
        foreach ([self::A, self::B] as $id) {
            File::deleteDirectory(storage_path("app/public/demo/{$id}"));
            File::deleteDirectory(storage_path("app/private/demo/{$id}"));
        }

        parent::tearDown();
    }

    public function test_a_request_without_a_sandbox_is_refused(): void
    {
        $this->getJson('/api/plans')->assertStatus(400);
        $this->getJson('/api/plans', [UseDemoSandbox::HEADER => 'not-an-id'])->assertStatus(400);
    }

    public function test_each_visitor_changes_only_their_own_copy(): void
    {
        $this->getJson('/api/plans', [UseDemoSandbox::HEADER => self::A])->assertOk();
        $this->assertFileExists("{$this->root}/sandboxes/".self::A.'.sqlite');

        $sandboxes = app(Sandboxes::class);

        $sandboxes->activate(self::A);
        $total = Plan::count();
        Plan::query()->delete();
        Storage::disk('public')->delete('logo.txt');

        $sandboxes->activate(self::B);
        $this->assertSame($total, Plan::count());
        $this->assertSame('template', Storage::disk('public')->get('logo.txt'));

        $sandboxes->activate(self::A);
        $this->assertSame(0, Plan::count());
        $this->assertFalse(Storage::disk('public')->exists('logo.txt'));

        // The template itself is untouched.
        Sandboxes::point(config('demo.template_path'), "{$this->root}/x", 'http://localhost', "{$this->root}/y");
        $this->assertSame($total, Plan::count());
    }

    public function test_reset_gives_the_visitor_a_fresh_copy(): void
    {
        $sandboxes = app(Sandboxes::class);
        $sandboxes->activate(self::A);
        Plan::query()->delete();
        DB::disconnect();

        $this->postJson('/api/demo/reset', [], [UseDemoSandbox::HEADER => self::A])->assertOk();

        $this->getJson('/api/plans', [UseDemoSandbox::HEADER => self::A])->assertOk()->assertJsonCount(3, 'plans');
    }

    public function test_idle_sandboxes_are_pruned(): void
    {
        $sandboxes = app(Sandboxes::class);
        $sandboxes->activate(self::A);
        $sandboxes->activate(self::B);
        DB::disconnect();

        touch($sandboxes->databasePath(self::A), time() - (config('demo.idle_minutes') + 1) * 60);

        $this->artisan('demo:prune')->assertSuccessful();

        $this->assertFalse($sandboxes->exists(self::A));
        $this->assertDirectoryDoesNotExist($sandboxes->filesPath('public', self::A));
        $this->assertTrue($sandboxes->exists(self::B));
    }
}
