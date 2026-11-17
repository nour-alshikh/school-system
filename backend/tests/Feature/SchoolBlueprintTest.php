<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AcademicYear;
use App\Models\AiUsage;
use App\Models\AuditLog;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\School;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\Subject;
use App\Models\User;
use App\Services\MembershipService;
use App\Services\SchoolBlueprint;
use App\Services\SchoolStructureTemplate;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Phase 2 of docs/ai-assistant-plan.md: "Describe your school" on the
 * landing page — a sentence becomes a blueprint, the visitor edits it, and
 * signup builds it.
 */
class SchoolBlueprintTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        config(['services.openrouter.key' => 'test-key', 'ai.caps.blueprint_daily' => 200]);
    }

    public function test_a_visitor_gets_a_blueprint_cut_to_the_limits(): void
    {
        $grade = fn (int $n) => ['name_en' => "Grade {$n}", 'name_ar' => "الصف {$n}", 'classrooms' => ['A', 'a', 'B', '']];
        $this->reply([
            'school_name' => 'Nile Valley School',
            'stages' => [
                ['name_en' => 'KG', 'name_ar' => 'رياض الأطفال', 'grades' => [$grade(0)]],
                ['name_en' => 'Primary', 'name_ar' => 'الابتدائية', 'grades' => array_map($grade, range(1, 6))],
                ['name_en' => 'No Arabic', 'grades' => [$grade(99)]],
                ['name' => ['en' => 'Preparatory', 'ar' => 'الإعدادية'], 'grades' => array_map($grade, range(7, 9))],
                ['name_en' => 'Secondary', 'name_ar' => 'الثانوية', 'grades' => array_map($grade, range(10, 15))],
                ['name_en' => 'Fifth', 'name_ar' => 'خامسة', 'grades' => [$grade(16)]],
            ],
            'subjects' => [
                ['name_en' => 'Mathematics', 'name_ar' => 'الرياضيات', 'stages' => [1, 2, 3, 7]],
                ['name_en' => 'mathematics', 'name_ar' => 'مكرر', 'stages' => [1]],
                ['name_en' => 'Nowhere', 'name_ar' => 'لا مكان', 'stages' => [9]],
            ],
            'academic_year' => 1999,
            'school_days' => [4, 0, 1, 2, 3, 9, 'x'],
            'currency' => 'egp',
            'notes' => ['Assumed two classrooms per grade.'],
        ]);

        $response = $this->withHeader('Accept-Language', 'ar')
            ->postJson('/api/school-blueprint', ['description' => 'Primary to secondary in Cairo, two classes per grade'])
            ->assertOk()
            ->assertJsonPath('fallback', false)
            ->assertJsonPath('blueprint.school_name', 'Nile Valley School')
            ->assertJsonPath('blueprint.slug', 'nile-valley-school')
            ->assertJsonPath('blueprint.currency', 'EGP')
            ->assertJsonPath('blueprint.school_days', [0, 1, 2, 3, 4])
            ->assertJsonPath('blueprint.academic_year', now()->year)
            ->assertJsonPath('blueprint.notes', ['Assumed two classrooms per grade.']);

        $stages = $response->json('blueprint.stages');
        $this->assertSame(['KG', 'Primary', 'Preparatory', 'Secondary'], array_column($stages, 'name_en'));
        $this->assertSame(SchoolBlueprint::MAX_GRADES, array_sum(array_map(fn ($s) => count($s['grades']), $stages)));
        $this->assertSame(['A', 'B'], $stages[0]['grades'][0]['classrooms']);
        $this->assertSame([['name_en' => 'Mathematics', 'name_ar' => 'الرياضيات', 'stages' => [1, 2, 3]]], $response->json('blueprint.subjects'));

        Http::assertSent(fn ($request) => str_contains($request['messages'][0]['content'], 'notes: up to 6 short sentences in Modern Standard Arabic')
            && $request['messages'][1]['content'] === "Description:\nPrimary to secondary in Cairo, two classes per grade");
        $this->assertDatabaseHas('ai_usage', ['feature' => 'draft.school_blueprint', 'user_id' => null, 'school_id' => null, 'ok' => true]);
    }

    public function test_a_blueprint_can_be_refined(): void
    {
        $current = $this->smallBlueprint();
        $this->reply([...$current, 'stages' => [...$current['stages'], ['name_en' => 'Secondary', 'name_ar' => 'الثانوية', 'grades' => [['name_en' => 'Grade 10', 'name_ar' => 'الصف العاشر', 'classrooms' => ['A']]]]]]);

        $this->postJson('/api/school-blueprint', ['description' => 'add a secondary stage', 'blueprint' => $current])
            ->assertOk()
            ->assertJsonPath('fallback', false)
            ->assertJsonCount(2, 'blueprint.stages');

        Http::assertSent(fn ($request) => str_starts_with($request['messages'][1]['content'], "Current structure:\n{")
            && str_ends_with($request['messages'][1]['content'], "Change it like this:\nadd a secondary stage"));
    }

    public function test_without_ai_the_visitor_still_gets_a_structure(): void
    {
        Http::fake();
        config(['services.openrouter.key' => null]);

        $this->postJson('/api/school-blueprint', ['description' => 'a small primary school'])
            ->assertOk()
            ->assertJsonPath('fallback', true)
            ->assertJsonPath('blueprint.notes', [__('api.blueprint_fallback')])
            ->assertJsonCount(count(SchoolStructureTemplate::STAGES), 'blueprint.stages');

        // Refining without AI keeps what the visitor had.
        $current = $this->smallBlueprint();
        $this->postJson('/api/school-blueprint', ['description' => 'add KG', 'blueprint' => $current])
            ->assertOk()
            ->assertJsonPath('fallback', true)
            ->assertJsonPath('blueprint.stages', $current['stages'])
            ->assertJsonPath('blueprint.notes', [__('api.blueprint_unchanged')]);

        Http::assertNothingSent();
    }

    public function test_an_unusable_reply_or_the_daily_cap_falls_back(): void
    {
        $this->reply(['stages' => []]);
        $this->postJson('/api/school-blueprint', ['description' => 'what is the weather'])
            ->assertOk()
            ->assertJsonPath('fallback', true);
        $this->assertDatabaseHas('ai_usage', ['feature' => 'draft.school_blueprint', 'ok' => false, 'error' => 'bad_reply']);

        config(['ai.caps.blueprint_daily' => 1]);
        $this->postJson('/api/school-blueprint', ['description' => 'a school'])->assertOk()->assertJsonPath('fallback', true);
        $this->assertSame(1, AiUsage::count());
    }

    public function test_the_input_is_checked_and_throttled(): void
    {
        Http::fake();
        config(['services.openrouter.key' => null]);

        $this->postJson('/api/school-blueprint', ['description' => 'x', 'website' => 'http://spam'])->assertStatus(422);
        $this->postJson('/api/school-blueprint', ['description' => str_repeat('x', 501)])->assertJsonValidationErrors('description');
        $this->postJson('/api/school-blueprint', [
            'description' => 'x',
            'blueprint' => [...$this->smallBlueprint(), 'stages' => array_fill(0, 5, $this->smallBlueprint()['stages'][0])],
        ])->assertJsonValidationErrors(['blueprint.stages']);

        foreach (range(4, 10) as $_) {
            $this->postJson('/api/school-blueprint', ['description' => 'a school'])->assertOk();
        }
        $this->postJson('/api/school-blueprint', ['description' => 'a school'])->assertTooManyRequests();
    }

    public function test_signup_builds_the_blueprint(): void
    {
        $blueprint = [
            ...$this->smallBlueprint(),
            'subjects' => [
                ['name_en' => 'Arabic', 'name_ar' => 'اللغة العربية', 'stages' => [0, 1]],
                ['name_en' => 'Physics', 'name_ar' => 'الفيزياء', 'stages' => [1]],
            ],
        ];
        $blueprint['stages'][] = ['name_en' => 'Secondary', 'name_ar' => 'الثانوية', 'grades' => [['name_en' => 'Grade 10', 'name_ar' => 'الصف العاشر', 'classrooms' => ['Science', 'Arts']]]];

        $token = $this->signUp(['blueprint' => $blueprint])->assertCreated()->json('token');
        $school = School::where('slug', 'nile-valley')->sole();

        app(TenantContext::class)->runAs($school, function () {
            $this->assertSame(['Primary', 'Secondary'], Stage::orderBy('id')->get()->map->getTranslation('name', 'en')->all());
            $this->assertSame(3, Grade::count());
            $this->assertSame(
                ['Grade 1 - A', 'Grade 1 - B', 'Grade 2 - A', 'Grade 10 - Science', 'Grade 10 - Arts'],
                Classroom::orderBy('id')->pluck('name')->all(),
            );
            $this->assertSame(['Primary', 'Secondary'], Subject::where('name->en', 'Arabic')->sole()->stages()->orderBy('stages.id')->get()->map->getTranslation('name', 'en')->all());
            $this->assertSame(['Secondary'], Subject::where('name->en', 'Physics')->sole()->stages->map->getTranslation('name', 'en')->all());
            $this->assertSame(now()->year, AcademicYear::where('is_current', true)->sole()->year);
            $this->assertSame('EGP', Setting::currency());
            $this->assertSame([0, 1, 2, 3, 4], Setting::schoolDays());
        });

        $steps = collect($this->withToken($token)->getJson('/api/admin/onboarding')->assertOk()->json('onboarding.steps'))->keyBy('key');
        foreach (['school_week_currency', 'academic_year', 'stages', 'grades', 'classrooms', 'subjects'] as $step) {
            $this->assertTrue($steps[$step]['done'], $step);
        }
        $this->assertTrue(AuditLog::where('action', 'school.self_registered')->sole()->details['blueprint']);
    }

    public function test_a_bad_blueprint_creates_nothing(): void
    {
        $blueprint = $this->smallBlueprint();
        $blueprint['stages'][0]['grades'][0]['classrooms'] = ['A', 'a'];
        $blueprint['stages'][0]['grades'] = [...$blueprint['stages'][0]['grades'], ...array_fill(0, 14, ['name_en' => 'G', 'name_ar' => 'ص', 'classrooms' => ['A']])];
        $blueprint['subjects'] = [['name_en' => 'Maths', 'name_ar' => 'رياضيات', 'stages' => [2]]];

        $this->signUp(['blueprint' => $blueprint])->assertJsonValidationErrors([
            'blueprint.stages',
            'blueprint.stages.0.grades.0.classrooms',
            'blueprint.subjects.0.stages',
        ]);

        $this->assertDatabaseMissing('schools', ['slug' => 'nile-valley']);
        $this->assertDatabaseMissing('users', ['email' => 'owner@nile.school']);
    }

    public function test_a_signed_in_user_adds_a_school_from_a_blueprint(): void
    {
        $user = User::factory()->create();
        app(TenantContext::class)->runAs(School::query()->oldest('id')->firstOrFail(), fn () => app(MembershipService::class)->grant($user, MembershipRole::Teacher));
        $token = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password', 'role' => 'teacher'])->json('token');

        $this->withToken($token)->postJson('/api/schools', ['school_name' => 'Second', 'slug' => 'second-school', 'blueprint' => $this->smallBlueprint()])
            ->assertCreated();

        app(TenantContext::class)->runAs(School::where('slug', 'second-school')->sole(), fn () => $this->assertSame(3, Classroom::count()));
    }

    public function test_the_standard_structure_is_the_default_blueprint(): void
    {
        // Throws if the standard structure ever breaks the limits.
        SchoolBlueprint::validate(SchoolBlueprint::default());

        $school = School::query()->oldest('id')->firstOrFail();
        app(TenantContext::class)->runAs($school, function () {
            app(SchoolStructureTemplate::class)->applyToEmptySchool();

            $this->assertSame(12, Grade::count());
            $this->assertSame(12, Classroom::count());
            $this->assertSame('Grade 1 - A', Classroom::orderBy('id')->value('name'));
            $this->assertSame(['Preparatory', 'Secondary'], Subject::where('name->en', 'French')->sole()->stages()->orderBy('stages.id')->get()->map->getTranslation('name', 'en')->all());
        });
    }

    /** Primary with two grades and three classrooms; Egyptian week and currency. */
    private function smallBlueprint(): array
    {
        return [
            'stages' => [[
                'name_en' => 'Primary',
                'name_ar' => 'الابتدائية',
                'grades' => [
                    ['name_en' => 'Grade 1', 'name_ar' => 'الصف الأول', 'classrooms' => ['A', 'B']],
                    ['name_en' => 'Grade 2', 'name_ar' => 'الصف الثاني', 'classrooms' => ['A']],
                ],
            ]],
            'subjects' => [['name_en' => 'Arabic', 'name_ar' => 'اللغة العربية', 'stages' => [0]]],
            'academic_year' => now()->year,
            'school_days' => [0, 1, 2, 3, 4],
            'currency' => 'EGP',
        ];
    }

    private function reply(array $content): void
    {
        Http::fake(['openrouter.ai/*' => Http::response(['choices' => [['message' => ['content' => json_encode($content, JSON_UNESCAPED_UNICODE)]]]])]);
    }

    private function signUp(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/school-signup', [
            'name' => 'Owner',
            'email' => 'owner@nile.school',
            'password' => 'password',
            'password_confirmation' => 'password',
            'school_name' => 'Nile Valley',
            'slug' => 'nile-valley',
            ...$overrides,
        ]);
    }
}
