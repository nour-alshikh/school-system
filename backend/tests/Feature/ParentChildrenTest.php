<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Models\AcademicYear;
use App\Models\BloodType;
use App\Models\Classroom;
use App\Models\Governorate;
use App\Models\Nationality;
use App\Models\Religion;
use App\Models\School;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\Student;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * docs/multi-tenancy.md, Decisions: one parent account for all their
 * children, at any school, shown together in the parent portal.
 */
class ParentChildrenTest extends TestCase
{
    use RefreshDatabase;

    private School $schoolA;

    private School $schoolB;

    /** @var array<int, array<string, int>> school id => ids for a registration */
    private array $fixtures = [];

    /** @var array<int, User> school id => its admin */
    private array $admins = [];

    private array $lookups;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        $this->schoolA = School::query()->oldest('id')->firstOrFail();
        $this->schoolB = School::create(['name' => 'Second School', 'slug' => 'second-school']);

        $nationality = Nationality::create(['name' => ['en' => 'N', 'ar' => 'N']]);
        $this->lookups = [
            'nationality_id' => $nationality->id,
            'governorate_id' => Governorate::create(['nationality_id' => $nationality->id, 'name' => ['en' => 'G', 'ar' => 'G']])->id,
            'blood_type_id' => BloodType::create(['name' => 'O+'])->id,
            'religion_id' => Religion::create(['name' => ['en' => 'R', 'ar' => 'R']])->id,
        ];

        foreach ([$this->schoolA, $this->schoolB] as $school) {
            $this->fixtures[$school->id] = $this->inSchool($school, function () use ($school) {
                $stage = Stage::create(['name' => ['en' => "Stage {$school->slug}", 'ar' => 'S']]);
                $grade = $stage->grades()->create(['name' => ['en' => "Grade at {$school->name}", 'ar' => 'G']]);
                $classroom = Classroom::create(['grade_id' => $grade->id, 'name' => 'A', 'capacity' => 30]);
                $year = AcademicYear::create(['year' => 2026, 'is_current' => true]);

                return ['stage_id' => $stage->id, 'grade_id' => $grade->id, 'classroom_id' => $classroom->id, 'academic_year_id' => $year->id];
            });

            $this->admins[$school->id] = User::factory()->create();
            $this->inSchool($school, fn () => app(MembershipService::class)->grant($this->admins[$school->id], MembershipRole::Admin));
        }
    }

    public function test_second_child_at_another_school_links_the_existing_parent_account(): void
    {
        $this->register($this->schoolA, 'kid1')->assertCreated()->assertJsonPath('parent_linked', false);

        // No parent password: the account exists.
        $this->register($this->schoolB, 'kid2', password: null)->assertCreated()->assertJsonPath('parent_linked', true);

        $parent = User::where('email', 'parent@family.test')->sole();
        $this->assertSame(2, Student::withoutSchoolScope()->where('parent_user_id', $parent->id)->count());
        $this->assertEqualsCanonicalizing(
            [$this->schoolA->id, $this->schoolB->id],
            $parent->memberships()->where('role', MembershipRole::Parent)->pluck('school_id')->all(),
        );
    }

    public function test_a_new_parent_email_still_needs_a_password(): void
    {
        $this->register($this->schoolA, 'kid1', password: null)->assertJsonValidationErrors('parent.password');
    }

    public function test_parent_sees_all_children_across_schools(): void
    {
        $this->register($this->schoolA, 'kid1');
        $this->register($this->schoolB, 'kid2', password: null);

        $response = $this->asParent()->getJson('/api/parent/children')->assertOk()->assertJsonCount(2, 'children');

        $bySchool = collect($response->json('children'))->keyBy('school_id');
        $this->assertSame('Second School', $bySchool[$this->schoolB->id]['school_name']);
        // Each child's school-scoped relations come from its own school.
        $this->assertSame("Grade at {$this->schoolA->name}", $bySchool[$this->schoolA->id]['student']['grade']['name_en']);
        $this->assertSame('Grade at Second School', $bySchool[$this->schoolB->id]['student']['grade']['name_en']);
    }

    public function test_parent_pages_take_any_of_their_children(): void
    {
        $this->register($this->schoolA, 'kid1');
        $this->register($this->schoolB, 'kid2', password: null);
        $kid2 = Student::withoutSchoolScope()->whereHas('user', fn ($q) => $q->where('email', 'kid2@family.test'))->sole();

        $token = $this->parentToken();

        foreach (['/api/parent/student', '/api/parent/attendance', '/api/parent/fees', '/api/parent/library-resources'] as $url) {
            $this->withToken($token)->getJson("{$url}?student_id={$kid2->id}")->assertOk();
        }

        $this->withToken($token)->getJson("/api/parent/student?student_id={$kid2->id}")
            ->assertJsonPath('student.id', $kid2->id);
    }

    public function test_each_childs_fees_come_in_their_own_schools_currency(): void
    {
        $this->register($this->schoolA, 'kid1');
        $this->register($this->schoolB, 'kid2', password: null);
        $this->inSchool($this->schoolA, fn () => Setting::updateOrCreate(['key' => 'currency'], ['value' => 'EGP', 'group' => 'general']));
        $this->inSchool($this->schoolB, fn () => Setting::updateOrCreate(['key' => 'currency'], ['value' => 'USD', 'group' => 'general']));
        $kid1 = Student::withoutSchoolScope()->whereHas('user', fn ($q) => $q->where('email', 'kid1@family.test'))->sole();
        $kid2 = Student::withoutSchoolScope()->whereHas('user', fn ($q) => $q->where('email', 'kid2@family.test'))->sole();

        // Signed in at school A, looking at a child at school B.
        $token = $this->parentToken();
        $this->withToken($token)->getJson("/api/parent/fees?student_id={$kid1->id}")->assertJsonPath('currency', 'EGP');
        $this->withToken($token)->getJson("/api/parent/fees?student_id={$kid2->id}")->assertJsonPath('currency', 'USD');

        $children = collect($this->withToken($token)->getJson('/api/parent/children')->json('children'))->keyBy('school_id');
        $this->assertSame('EGP', $children[$this->schoolA->id]['currency']);
        $this->assertSame('USD', $children[$this->schoolB->id]['currency']);
    }

    public function test_parent_cannot_read_someone_elses_child(): void
    {
        $this->register($this->schoolA, 'kid1');
        $this->register($this->schoolB, 'other', parentEmail: 'other.parent@family.test');
        $other = Student::withoutSchoolScope()->whereHas('user', fn ($q) => $q->where('email', 'other@family.test'))->sole();

        $this->withToken($this->parentToken())->getJson("/api/parent/attendance?student_id={$other->id}")->assertNotFound();
    }

    public function test_deleting_a_child_keeps_a_parent_account_shared_with_a_sibling(): void
    {
        $this->register($this->schoolA, 'kid1');
        $this->register($this->schoolB, 'kid2', password: null);
        $kid1 = Student::withoutSchoolScope()->whereHas('user', fn ($q) => $q->where('email', 'kid1@family.test'))->sole();

        $this->asAdmin($this->schoolA)->deleteJson("/api/students/{$kid1->id}")->assertSuccessful();

        $parent = User::where('email', 'parent@family.test')->first();
        $this->assertNotNull($parent, 'shared parent account must survive');
        $this->assertSame(1, Student::withoutSchoolScope()->where('parent_user_id', $parent->id)->count());
        $this->assertSame(MembershipStatus::Left, $parent->memberships()->where('school_id', $this->schoolA->id)->sole()->status);
        $this->assertSame(MembershipStatus::Active, $parent->memberships()->where('school_id', $this->schoolB->id)->sole()->status);
    }

    public function test_deleting_an_only_child_removes_a_parent_account_used_nowhere_else(): void
    {
        $this->register($this->schoolA, 'kid1');
        $kid1 = Student::withoutSchoolScope()->sole();

        $this->asAdmin($this->schoolA)->deleteJson("/api/students/{$kid1->id}")->assertSuccessful();

        $this->assertNull(User::where('email', 'parent@family.test')->first());
    }

    public function test_a_school_cannot_change_the_password_of_a_parent_account_shared_with_another_school(): void
    {
        $this->register($this->schoolA, 'kid1');
        $this->register($this->schoolB, 'kid2', password: null);
        $kid1 = Student::withoutSchoolScope()->whereHas('user', fn ($q) => $q->where('email', 'kid1@family.test'))->sole();

        $this->asAdmin($this->schoolA)->putJson("/api/students/{$kid1->id}", [
            'parent' => ['password' => 'hijacked-pass-1', 'password_confirmation' => 'hijacked-pass-1'],
        ])->assertJsonValidationErrors('parent.email');

        $this->assertNotNull($this->parentToken(), 'original password still works');
    }

    private function register(School $school, string $kid, ?string $password = 'parent-pass-1', string $parentEmail = 'parent@family.test'): TestResponse
    {
        $person = fn (string $name) => [
            'name' => $name, 'job' => 'J', 'national_id' => uniqid(), 'phone' => '1',
            'nationality_id' => $this->lookups['nationality_id'], 'governorate_id' => $this->lookups['governorate_id'],
            'blood_type_id' => $this->lookups['blood_type_id'], 'religion_id' => $this->lookups['religion_id'], 'address' => 'A',
        ];

        return $this->asAdmin($school)->postJson('/api/students', [
            'student' => [
                'name' => ['en' => $kid, 'ar' => $kid],
                'email' => "{$kid}@family.test",
                'password' => 'student-pass-1', 'password_confirmation' => 'student-pass-1',
                'gender' => 'male',
                'nationality_id' => $this->lookups['nationality_id'],
                'governorate_id' => $this->lookups['governorate_id'],
                'blood_type_id' => $this->lookups['blood_type_id'],
                ...$this->fixtures[$school->id],
            ],
            'parent' => array_filter([
                'email' => $parentEmail,
                'password' => $password,
                'password_confirmation' => $password,
            ]),
            'father' => $person('Father'),
            'mother' => $person('Mother'),
        ]);
    }

    private function asAdmin(School $school): self
    {
        $this->app['auth']->forgetGuards();
        $token = $this->flushHeaders()->postJson('/api/login', [
            'email' => $this->admins[$school->id]->email, 'password' => 'password', 'role' => 'admin',
        ])->assertOk()->json('token');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }

    private function parentToken(): string
    {
        $this->app['auth']->forgetGuards();
        $response = $this->flushHeaders()->postJson('/api/login', [
            'email' => 'parent@family.test', 'password' => 'parent-pass-1', 'role' => 'parent',
            'school_id' => $this->schoolA->id,
        ])->assertOk();
        $this->app['auth']->forgetGuards();

        return $response->json('token');
    }

    private function asParent(): self
    {
        return $this->withToken($this->parentToken());
    }

    private function inSchool(School $school, callable $callback): mixed
    {
        return app(TenantContext::class)->runAs($school, $callback);
    }
}
