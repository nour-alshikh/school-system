<?php

namespace Tests\Feature;

use App\Enums\MembershipRole;
use App\Models\AcademicYear;
use App\Models\BloodType;
use App\Models\Classroom;
use App\Models\Governorate;
use App\Models\Media;
use App\Models\Nationality;
use App\Models\Religion;
use App\Models\School;
use App\Models\Stage;
use App\Models\User;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Student attachments (photos of children) are on the private disk and only
 * reachable through GET /api/attachments/{media}: staff of that school, the
 * student, or their parent.
 */
class StudentAttachmentPrivacyTest extends TestCase
{
    use RefreshDatabase;

    private School $school;

    private School $otherSchool;

    private Media $photo;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        $this->seed(RolePermissionSeeder::class);

        $this->school = School::query()->oldest('id')->firstOrFail();
        $this->otherSchool = School::create(['name' => 'Other School', 'slug' => 'other-school']);

        $this->userWith('admin@school.test', $this->school, MembershipRole::Admin);
        $this->userWith('admin@other.test', $this->otherSchool, MembershipRole::Admin);
        $this->userWith('teacher@school.test', $this->school, MembershipRole::Teacher);

        $this->registerStudentWithPhoto();
        $this->photo = Media::sole();
    }

    public function test_attachment_is_stored_on_the_private_disk(): void
    {
        $this->assertSame('local', $this->photo->disk);
        Storage::disk('local')->assertExists($this->photo->getPathRelativeToRoot());
        Storage::disk('public')->assertMissing($this->photo->getPathRelativeToRoot());
    }

    public function test_api_returns_a_url_through_the_api_not_a_public_file_url(): void
    {
        $this->as('admin@school.test', 'admin')
            ->getJson("/api/students/{$this->photo->model_id}")
            ->assertOk()
            ->assertJsonPath('student.attachments.0.url', "/api/attachments/{$this->photo->id}");
    }

    public function test_staff_the_student_and_their_parent_can_view_it(): void
    {
        foreach ([['admin@school.test', 'admin', 'staff-pass'], ['kid@family.test', 'student', 'student-pass-1'], ['parent@family.test', 'parent', 'parent-pass-1']] as [$email, $role, $password]) {
            $this->as($email, $role, $password)->get("/api/attachments/{$this->photo->id}")
                ->assertOk()
                ->assertHeader('Cache-Control', 'max-age=300, private');
        }
    }

    public function test_download_sends_the_file_name(): void
    {
        $this->as('admin@school.test', 'admin')->get("/api/attachments/{$this->photo->id}?download=1")
            ->assertOk()
            ->assertDownload('photo.jpg');
    }

    public function test_everyone_else_gets_404(): void
    {
        $this->as('admin@other.test', 'admin')->get("/api/attachments/{$this->photo->id}")->assertNotFound();
        // A teacher at the same school has no manage-students permission.
        $this->as('teacher@school.test', 'teacher')->get("/api/attachments/{$this->photo->id}")->assertNotFound();
    }

    public function test_guests_get_401(): void
    {
        $this->app['auth']->forgetGuards();
        $this->flushHeaders()->getJson("/api/attachments/{$this->photo->id}")->assertUnauthorized();
    }

    public function test_migration_moves_existing_attachments_off_the_public_disk(): void
    {
        $path = $this->photo->getPathRelativeToRoot();

        // As it was before: on the public disk.
        Storage::disk('public')->put($path, Storage::disk('local')->get($path));
        Storage::disk('local')->delete($path);
        DB::table('media')->where('id', $this->photo->id)->update(['disk' => 'public', 'conversions_disk' => 'public']);

        $migration = require database_path('migrations/2026_09_28_160000_move_student_attachments_to_private_disk.php');
        $migration->up();

        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertMissing($path);
        $this->assertSame('local', $this->photo->fresh()->disk);
    }

    private function registerStudentWithPhoto(): void
    {
        $nationality = Nationality::create(['name' => ['en' => 'N', 'ar' => 'N']]);
        $lookups = [
            'nationality_id' => $nationality->id,
            'governorate_id' => Governorate::create(['nationality_id' => $nationality->id, 'name' => ['en' => 'G', 'ar' => 'G']])->id,
            'blood_type_id' => BloodType::create(['name' => 'O+'])->id,
        ];
        $religionId = Religion::create(['name' => ['en' => 'R', 'ar' => 'R']])->id;

        $ids = app(TenantContext::class)->runAs($this->school, function () {
            $stage = Stage::create(['name' => ['en' => 'S', 'ar' => 'S']]);
            $grade = $stage->grades()->create(['name' => ['en' => 'G1', 'ar' => 'G1']]);

            return [
                'stage_id' => $stage->id,
                'grade_id' => $grade->id,
                'classroom_id' => Classroom::create(['grade_id' => $grade->id, 'name' => 'A', 'capacity' => 30])->id,
                'academic_year_id' => AcademicYear::create(['year' => 2026, 'is_current' => true])->id,
            ];
        });

        $guardian = fn () => [
            'name' => 'Guardian', 'job' => 'J', 'national_id' => uniqid(), 'phone' => '1', 'address' => 'A',
            'religion_id' => $religionId, ...$lookups,
        ];

        $this->as('admin@school.test', 'admin')->post('/api/students', [
            'student' => [
                'name' => ['en' => 'Kid', 'ar' => 'Kid'],
                'email' => 'kid@family.test',
                'password' => 'student-pass-1', 'password_confirmation' => 'student-pass-1',
                'gender' => 'male',
                ...$lookups,
                ...$ids,
            ],
            'parent' => ['email' => 'parent@family.test', 'password' => 'parent-pass-1', 'password_confirmation' => 'parent-pass-1'],
            'father' => $guardian(),
            'mother' => $guardian(),
            'attachments' => [UploadedFile::fake()->image('photo.jpg')],
        ], ['Accept' => 'application/json'])->assertCreated();
    }

    private function userWith(string $email, School $school, MembershipRole $role): void
    {
        $user = User::factory()->create(['email' => $email, 'password' => 'staff-pass']);
        app(TenantContext::class)->runAs($school, fn () => app(MembershipService::class)->grant($user, $role));
    }

    private function as(string $email, string $role, string $password = 'staff-pass'): self
    {
        $this->app['auth']->forgetGuards();
        $token = $this->flushHeaders()->postJson('/api/login', compact('email', 'password', 'role'))->assertOk()->json('token');
        $this->app['auth']->forgetGuards();

        return $this->withToken($token);
    }
}
