<?php

namespace Database\Seeders\Demo;

use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\School;
use App\Models\Subject;
use App\Tenancy\TenantContext;

/**
 * The accounts that show off memberships across schools: a parent with a
 * child at each school, and a teacher who teaches at both.
 */
class CrossSchoolPeopleSeeder
{
    public const FAMILY_PARENT_EMAIL = 'family.parent@demo.school';

    public const SHARED_TEACHER_EMAIL = 'shared.teacher@demo.school';

    public function __construct(private readonly DemoPeople $people) {}

    public function run(School $default, School $hilltop): void
    {
        $parent = $this->people->user('Hana Mostafa', self::FAMILY_PARENT_EMAIL);

        foreach ([[$default, 'Grade 3 - A'], [$hilltop, 'Grade 2 - A']] as [$school, $classroomName]) {
            app(TenantContext::class)->runAs($school, function () use ($parent, $classroomName) {
                $classroom = Classroom::where('name', $classroomName)->firstOrFail();
                $year = AcademicYear::where('is_current', true)->firstOrFail();

                // The same parent account at both schools: the "link the
                // existing parent" path of registering a second child.
                $this->people->student($classroom, $year, 'demo.school', $parent);

                // One teacher, one login, at both schools: English in this
                // classroom.
                $teacher = $this->people->teacher('Rana Adel', self::SHARED_TEACHER_EMAIL, ['English']);
                $english = Subject::all()->first(fn (Subject $s) => $s->getTranslation('name', 'en') === 'English');
                $classroom->subjectTeachers()->updateOrCreate(['subject_id' => $english->id], ['teacher_id' => $teacher->id]);
            });
        }
    }
}
