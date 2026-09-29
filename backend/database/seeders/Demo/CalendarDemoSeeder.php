<?php

namespace Database\Seeders\Demo;

use App\Models\AcademicYear;
use App\Models\CalendarEvent;
use App\Models\Classroom;
use App\Models\ClassroomSubjectTeacher;
use App\Models\Meeting;
use App\Models\User;

/**
 * School events over this month and next, and three online meetings next
 * week. Meetings get a placeholder link instead of a real Zoom meeting
 * (docs/demo-seeder-plan.md, decisions).
 */
class CalendarDemoSeeder
{
    private const EVENTS = [
        [-12, 'Parents’ meeting day', 'Meet your child’s teachers in their classrooms, 4–7 pm.'],
        [-5, 'Science fair', 'Students present their projects in the main hall.'],
        [2, 'Sports day', 'Races and team games on the school field. Wear sports clothes.'],
        [6, 'School trip', 'Visit to the national museum. Permission slips due the day before.'],
        [11, 'Mid-term exams begin', 'Exam timetables are on each classroom’s page.'],
        [18, 'Mid-term exams end', null],
        [25, 'Public holiday', 'The school is closed.'],
        [33, 'Reading week', 'Every class spends 20 minutes a day reading together.'],
    ];

    public function run(User $admin): void
    {
        foreach (self::EVENTS as [$offset, $title, $description]) {
            CalendarEvent::create([
                'title' => $title,
                'description' => $description,
                'date' => now()->addDays($offset)->toDateString(),
                'created_by' => $admin->id,
            ]);
        }

        $year = AcademicYear::where('is_current', true)->firstOrFail();
        $classrooms = Classroom::whereHas('students')->orderBy('id')->take(3)->get();

        foreach ($classrooms->values() as $i => $classroom) {
            $teacherUserId = ClassroomSubjectTeacher::with('teacher')->where('classroom_id', $classroom->id)->orderBy('id')->first()?->teacher?->user_id;

            $meeting = Meeting::create([
                'title' => "Weekly review — {$classroom->name}",
                'description' => 'Questions about this week’s lessons and homework.',
                'start_time' => now()->next('Monday')->addDays($i)->setTime(10, 0),
                'duration_minutes' => 45,
                // No Zoom: a placeholder id and link.
                'zoom_meeting_id' => "demo-{$classroom->id}",
                'join_url' => 'https://example.com/demo-meeting',
                'start_url' => 'https://example.com/demo-meeting?host=1',
                'academic_year_id' => $year->id,
                'created_by' => $teacherUserId ?? $admin->id,
            ]);

            $meeting->classrooms()->attach([$classroom->id]);
        }
    }
}
