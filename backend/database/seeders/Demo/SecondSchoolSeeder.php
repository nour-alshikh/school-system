<?php

namespace Database\Seeders\Demo;

use App\Enums\MembershipRole;
use App\Enums\SchoolSource;
use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\School;
use App\Models\Stage;
use App\Models\Subject;
use App\Models\User;
use App\Services\SchoolProvisioner;
use App\Services\SchoolStructureTemplate;
use App\Tenancy\TenantContext;
use Database\Seeders\ClassroomSubjectTeacherSeeder;

/**
 * Hilltop School: smaller than the default school so the two are easy to
 * tell apart — one stage, three grades, two classrooms each, four
 * subjects, four teachers, twelve students.
 */
class SecondSchoolSeeder
{
    public const ADMIN_EMAIL = 'admin@hilltop.demo';

    private const GRADES = 3;

    private const SUBJECTS = ['Arabic', 'English', 'Mathematics', 'Science'];

    private const TEACHERS = [
        ['name' => 'Layla Hamdi', 'email' => 'layla.hamdi@hilltop.demo', 'subjects' => ['Arabic']],
        ['name' => 'Karim Fawzy', 'email' => 'karim.fawzy@hilltop.demo', 'subjects' => ['English']],
        ['name' => 'Rania Soliman', 'email' => 'rania.soliman@hilltop.demo', 'subjects' => ['Mathematics']],
        ['name' => 'Tamer Nasser', 'email' => 'tamer.nasser@hilltop.demo', 'subjects' => ['Science']],
    ];

    public function __construct(private readonly DemoPeople $people) {}

    public function run(User $platformAdmin): School
    {
        // Created with a password first, so the provisioner treats it as an
        // existing account: no invitation email.
        $this->people->user('Hilltop Admin', self::ADMIN_EMAIL);

        ['school' => $school] = app(SchoolProvisioner::class)->create('Hilltop School', 'hilltop', 'Hilltop Admin', self::ADMIN_EMAIL);
        $school->update(['source' => SchoolSource::Seed]);

        app(TenantContext::class)->runAs($school, function () use ($platformAdmin) {
            // The demo admin runs both schools (and switches between them).
            $this->people->grant($platformAdmin, MembershipRole::Admin);

            $year = AcademicYear::create(['year' => 2025, 'is_current' => true]);
            $this->structure();

            foreach (self::TEACHERS as $row) {
                $this->people->teacher($row['name'], $row['email'], $row['subjects']);
            }
            (new ClassroomSubjectTeacherSeeder)->run();

            foreach (Classroom::orderBy('id')->get() as $classroom) {
                $this->people->student($classroom, $year, 'hilltop.demo');
                $this->people->student($classroom, $year, 'hilltop.demo');
            }
        });

        return $school;
    }

    /** Primary only: its first three grades, sections A and B, four subjects. */
    private function structure(): void
    {
        $primary = SchoolStructureTemplate::STAGES[0];
        $stage = Stage::create(['name' => $primary['name']]);

        foreach (array_slice($primary['grades'], 0, self::GRADES) as $name) {
            $grade = Grade::create(['stage_id' => $stage->id, 'name' => $name]);

            foreach (['A', 'B'] as $section) {
                Classroom::create(['grade_id' => $grade->id, 'name' => "{$name['en']} - {$section}", 'capacity' => 25]);
            }
        }

        foreach (SchoolStructureTemplate::SUBJECTS as $row) {
            if (in_array($row['name']['en'], self::SUBJECTS, true)) {
                Subject::create(['name' => $row['name']])->stages()->sync([$stage->id]);
            }
        }
    }
}
