<?php

namespace Database\Seeders;

use App\Enums\TeacherStatus;
use App\Models\Grade;
use App\Models\Teacher;
use Illuminate\Database\Seeder;

class ClassroomSubjectTeacherSeeder extends Seeder
{
    /**
     * Demo data for the classroom subject/teacher picker (see
     * ClassroomSubjectTeachers on the frontend): every classroom gets a
     * teacher assigned for each subject taught in its grade — picking
     * whichever eligible teacher (Teacher::subjects) comes first, cycling
     * through the rest when a subject has more than one.
     */
    public function run(): void
    {
        Grade::with(['stage.subjects.teachers', 'classrooms'])->get()->each(function (Grade $grade) {
            $subjects = $grade->stage->subjects;

            foreach ($grade->classrooms as $index => $classroom) {
                foreach ($subjects as $subject) {
                    // Active teachers first: an inactive or on-leave
                    // teacher shouldn't get the only classrooms with
                    // students (the "A" sections) when an active one can.
                    $eligibleTeachers = $subject->teachers
                        ->sortBy(fn (Teacher $t) => [$t->status !== TeacherStatus::Active, $t->id])
                        ->values();

                    if ($eligibleTeachers->isEmpty()) {
                        continue;
                    }

                    $teacher = $eligibleTeachers[$index % $eligibleTeachers->count()];

                    $classroom->subjectTeachers()->firstOrCreate(
                        ['subject_id' => $subject->id],
                        ['teacher_id' => $teacher->id]
                    );
                }
            }
        });
    }
}
