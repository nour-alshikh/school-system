<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\School;
use App\Models\Stage;
use App\Models\Subject;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\BelongsToSchool;
use App\Tenancy\MissingSchoolContext;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

/**
 * Step 3 of docs/multi-tenancy.md: one school's data is invisible to
 * another, and touching school-owned data with no school set fails loudly.
 */
class SchoolIsolationTest extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;

    private School $schoolB;

    private TenantContext $context;

    protected function setUp(): void
    {
        parent::setUp();

        // ResolveSchool is still hard-wired to the oldest school, so A is
        // the one every request acts as.
        $this->schoolA = School::query()->oldest('id')->firstOrFail();
        $this->schoolB = School::create(['name' => 'Second School', 'slug' => 'second-school']);
        $this->context = app(TenantContext::class);
    }

    public function test_school_id_is_filled_from_the_current_school_on_create(): void
    {
        $stage = $this->context->runAs($this->schoolB, fn () => $this->makeStage('B stage'));

        $this->assertSame($this->schoolB->id, $stage->school_id);
    }

    public function test_queries_only_see_the_current_schools_rows(): void
    {
        $a = $this->context->runAs($this->schoolA, fn () => $this->makeStage('A stage'));
        $b = $this->context->runAs($this->schoolB, fn () => $this->makeStage('B stage'));

        $this->context->set($this->schoolA);

        $this->assertSame([$a->id], Stage::pluck('id')->all());
        $this->assertNull(Stage::find($b->id));
        $this->assertSame(2, Stage::withoutSchoolScope()->count());
    }

    public function test_querying_without_a_current_school_throws(): void
    {
        $this->expectException(MissingSchoolContext::class);

        Stage::count();
    }

    public function test_creating_without_a_current_school_throws(): void
    {
        $this->expectException(MissingSchoolContext::class);

        $this->makeStage('orphan');
    }

    public function test_api_cannot_list_or_touch_another_schools_record(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $admin = User::factory()->create();
        $this->context->runAs($this->schoolA, fn () => app(MembershipService::class)->grant($admin, MembershipRole::Admin));

        $this->context->runAs($this->schoolA, fn () => $this->makeStage('Only In A'));
        $b = $this->context->runAs($this->schoolB, fn () => $this->makeStage('Only In B'));

        $this->actingAs($admin)->getJson('/api/stages')
            ->assertOk()
            ->assertSee('Only In A')
            ->assertDontSee('Only In B');

        $this->actingAs($admin)->deleteJson("/api/stages/{$b->id}")->assertNotFound();
        $this->assertTrue(DB::table('stages')->where('id', $b->id)->exists());
    }

    public function test_exists_validation_rejects_another_schools_id(): void
    {
        $a = $this->context->runAs($this->schoolA, fn () => $this->makeStage('A stage'));
        $b = $this->context->runAs($this->schoolB, fn () => $this->makeStage('B stage'));

        $this->context->set($this->schoolA);

        $this->assertTrue(Validator::make(['id' => $a->id], ['id' => 'exists:stages,id'])->passes());
        $this->assertTrue(Validator::make(['id' => $b->id], ['id' => 'exists:stages,id'])->fails());
    }

    public function test_pivot_rows_get_the_current_school_and_are_read_per_school(): void
    {
        $this->context->set($this->schoolA);
        $stage = $this->makeStage('A stage');
        $subject = Subject::create(['name' => ['en' => 'Math', 'ar' => 'Math']]);

        $subject->stages()->attach($stage);

        $this->assertSame($this->schoolA->id, DB::table('subject_stage')->value('school_id'));
        $this->assertSame([$stage->id], $subject->stages()->pluck('stages.id')->all());
    }

    public function test_database_rejects_a_reference_to_another_schools_row(): void
    {
        $gradeInA = $this->context->runAs($this->schoolA, function () {
            return $this->makeStage('A stage')->grades()->create(['name' => ['en' => 'G1', 'ar' => 'G1']]);
        });

        // Raw inserts bypass every app-level check, so only the composite
        // (school_id, grade_id) foreign key can tell these two apart.
        $row = ['grade_id' => $gradeInA->id, 'name' => 'X'];
        DB::table('classrooms')->insert([...$row, 'school_id' => $this->schoolA->id]);

        $this->expectException(QueryException::class);
        DB::table('classrooms')->insert([...$row, 'school_id' => $this->schoolB->id]);
    }

    public function test_every_model_on_a_school_owned_table_uses_belongs_to_school(): void
    {
        // Media copies school_id from its owner (avatars stay null) and
        // memberships are how a global user spans schools — both by design.
        $exempt = ['Media', 'SchoolMembership'];

        foreach (glob(app_path('Models/*.php')) as $file) {
            $name = basename($file, '.php');
            $class = "App\\Models\\{$name}";

            if (in_array($name, $exempt, true) || ! is_subclass_of($class, Model::class)) {
                continue;
            }

            if (Schema::hasColumn((new $class)->getTable(), 'school_id')) {
                $this->assertContains(BelongsToSchool::class, class_uses_recursive($class), "{$class} must use BelongsToSchool");
            }
        }
    }

    private function makeStage(string $name): Stage
    {
        return Stage::create(['name' => ['en' => $name, 'ar' => $name]]);
    }
}
