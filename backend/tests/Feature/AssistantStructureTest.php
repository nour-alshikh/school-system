<?php

namespace Tests\Feature;

use App\Models\AiUsage;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\School;
use App\Models\Stage;
use App\Models\Subject;
use App\Tenancy\TenantContext;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Phase 6 of docs/ai-assistant-plan.md, "set up structure": the assistant
 * drafts additions to an existing school's structure, the card previews
 * only what's new, and confirming adds it — skipping whatever exists,
 * never renaming or removing. Runs on the demo seed (Primary › Grade 1 ›
 * "Grade 1 - A/B/C", Mathematics, …).
 */
class AssistantStructureTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    /** What the second AI call drafts: a new stage, a new section in an existing grade, an existing one, subjects. */
    private const ADDITIONS = [
        'stages' => [
            ['name_en' => 'Kindergarten', 'name_ar' => 'رياض الأطفال', 'grades' => [
                ['name_en' => 'KG 1', 'name_ar' => 'الروضة الأولى', 'classrooms' => ['A', 'B']],
                ['name_en' => 'KG 2', 'name_ar' => 'الروضة الثانية', 'classrooms' => ['A']],
            ]],
            ['name_en' => 'primary', 'name_ar' => 'الابتدائية', 'grades' => [
                ['name_en' => 'Grade 1', 'name_ar' => 'الصف الأول', 'classrooms' => ['A', 'D']],
            ]],
        ],
        'subjects' => [
            ['name_en' => 'Mathematics', 'name_ar' => 'الرياضيات', 'stages' => [0, 1]],
            ['name_en' => 'Play', 'name_ar' => 'اللعب', 'stages' => [0]],
        ],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();
        $this->seed(DatabaseSeeder::class);

        $this->school = School::oldest('id')->firstOrFail();
        config([
            'services.openrouter.key' => 'test-key',
            'ai.caps' => ['user_daily' => 100, 'school_daily' => 1000],
        ]);
    }

    public function test_the_card_previews_only_what_is_new_and_confirming_adds_it(): void
    {
        $admin = $this->login('admin@demo.school', 'admin');
        $before = $this->counts();

        $this->replies(
            ['reply' => 'Here’s what I’d add.', 'action' => 'set_up_structure', 'fields' => ['request' => 'Add a kindergarten with 2 grades, and a 4th class in Grade 1']],
            self::ADDITIONS,
        );

        $response = $this->ask($admin, 'Add a kindergarten with 2 grades, and a 4th class in Grade 1')->assertOk()
            ->assertJsonPath('messages.1.action.name', 'set_up_structure')
            ->assertJsonPath('messages.1.action.warnings', ['structure_existing_skipped'])
            ->assertJsonPath('messages.1.action.fields.preview.counts', ['stages' => 1, 'grades' => 2, 'classrooms' => 4, 'subjects' => 1, 'subject_stages' => 1]);

        $preview = $response->json('messages.1.action.fields.preview');
        $this->assertSame(['KG 1 - A', 'KG 1 - B'], $preview['stages'][0]['grades'][0]['classrooms']);
        // The existing stage and grade keep their own names; only "D" is new there.
        $this->assertSame('Primary', $preview['stages'][1]['name_en']);
        $this->assertSame(['Grade 1 - D'], $preview['stages'][1]['grades'][0]['classrooms']);
        $this->assertSame([['name_en' => 'Kindergarten', 'name_ar' => 'رياض الأطفال']], $preview['subjects'][0]['stages']);

        // The second call got the current structure, by name.
        $structureCall = Http::recorded()[1][0]['messages'][1]['content'];
        $this->assertStringContainsString('"Grade 1 - A"', $structureCall);
        $this->assertSame(['assistant', 'draft.structure_additions'], AiUsage::orderBy('id')->pluck('feature')->all());

        // Nothing saved until confirmed.
        $this->assertSame($before, $this->counts());

        $this->as($admin)->postJson('/api/structure/additions', ['additions' => $response->json('messages.1.action.fields.additions')])
            ->assertCreated()
            ->assertJsonPath('added', ['stages' => 1, 'grades' => 2, 'classrooms' => 4, 'subjects' => 1, 'subject_stages' => 1]);

        $this->inSchool(function () use ($before) {
            $this->assertSame([$before[0] + 1, $before[1] + 2, $before[2] + 4, $before[3] + 1], $this->counts());
            $kg = Stage::where('name->en', 'Kindergarten')->sole();
            $this->assertSame(['Mathematics', 'Play'], Subject::whereHas('stages', fn ($q) => $q->whereKey($kg->id))->orderBy('id')->get()->map->getTranslation('name', 'en')->all());
            $grade1 = Grade::where('name->en', 'Grade 1')->sole();
            $this->assertSame(['Grade 1 - A', 'Grade 1 - B', 'Grade 1 - C', 'Grade 1 - D'], $grade1->classrooms()->orderBy('name')->pluck('name')->all());
        });

        // Confirming twice adds nothing more.
        $this->as($admin)->postJson('/api/structure/additions', ['additions' => self::ADDITIONS])
            ->assertCreated()
            ->assertJsonPath('added', ['stages' => 0, 'grades' => 0, 'classrooms' => 0, 'subjects' => 0, 'subject_stages' => 0]);
    }

    public function test_nothing_new_or_an_unusable_draft_is_no_card(): void
    {
        $admin = $this->login('admin@demo.school', 'admin');

        $existing = ['stages' => [['name_en' => 'Primary', 'name_ar' => 'الابتدائية', 'grades' => [['name_en' => 'Grade 1', 'name_ar' => 'الصف الأول', 'classrooms' => ['A']]]]], 'subjects' => []];
        foreach ([$existing, ['stages' => [], 'subjects' => []], ['not' => 'json shape']] as $draft) {
            $this->replies(['reply' => 'Sure.', 'action' => 'set_up_structure', 'fields' => ['request' => 'Add Grade 1 A']], $draft);
            $this->ask($admin, 'Add Grade 1 A')->assertOk()
                ->assertJsonPath('messages.1.action', null)
                ->assertJsonPath('messages.1.content', "Sure.\n\n".__('api.assistant_action_failed'));
        }
    }

    public function test_only_manage_academics_is_offered_it_and_can_confirm(): void
    {
        $teacher = $this->login('mona.ali@teachers.demo', 'teacher');

        $this->replies(['reply' => 'Done.', 'action' => 'set_up_structure', 'fields' => ['request' => 'Add a stage']]);
        $this->ask($teacher, 'Add a stage')->assertOk()->assertJsonPath('messages.1.action', null);
        $this->assertStringNotContainsString('set_up_structure(', Http::recorded()[0][0]['messages'][0]['content']);
        Http::assertSentCount(1);

        $this->as($teacher)->postJson('/api/structure/additions', ['additions' => self::ADDITIONS])->assertForbidden();
    }

    public function test_confirm_validates_the_additions(): void
    {
        $admin = $this->login('admin@demo.school', 'admin');

        $this->as($admin)->postJson('/api/structure/additions', ['additions' => ['stages' => [], 'subjects' => []]])
            ->assertJsonValidationErrors('additions.stages');
        $this->as($admin)->postJson('/api/structure/additions', ['additions' => ['stages' => [], 'subjects' => [['name_en' => 'Art', 'name_ar' => 'الفنون', 'stages' => [2]]]]])
            ->assertJsonValidationErrors('additions.subjects.0.stages');
        $this->as($admin)->postJson('/api/structure/additions', ['additions' => ['stages' => [['name_en' => 'X', 'name_ar' => 'س', 'grades' => [['name_en' => 'G', 'name_ar' => 'ص', 'classrooms' => ['A', 'a']]]]], 'subjects' => []]])
            ->assertJsonValidationErrors('additions.stages.0.grades.0.classrooms');
    }

    /** @return array{0: int, 1: int, 2: int, 3: int} stages, grades, classrooms, subjects */
    private function counts(): array
    {
        return $this->inSchool(fn () => [Stage::count(), Grade::count(), Classroom::count(), Subject::count()]);
    }

    private function replies(array ...$replies): void
    {
        Http::swap(new Factory(app('events')));
        $sequence = Http::sequence();
        foreach ($replies as $reply) {
            $sequence->push(['model' => 'test/model', 'choices' => [['message' => ['content' => json_encode($reply, JSON_UNESCAPED_UNICODE)]]]]);
        }
        Http::fake(['openrouter.ai/*' => $sequence]);
    }

    private function ask(string $token, string $message): TestResponse
    {
        return $this->as($token)->postJson('/api/assistant/messages', ['message' => $message, 'links' => []]);
    }

    private function login(string $email, string $role): string
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->postJson('/api/login', [
            'email' => $email, 'password' => 'password', 'role' => $role, 'school_id' => $this->school->id,
        ])->assertOk()->json('token');
    }

    private function as(string $token): self
    {
        $this->app['auth']->forgetGuards();

        return $this->flushHeaders()->withToken($token);
    }

    private function inSchool(callable $fn): mixed
    {
        return app(TenantContext::class)->runAs($this->school, $fn);
    }
}
