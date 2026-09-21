<?php

namespace App\Http\Controllers\TeacherPortal;

use App\Enums\StudentStatus;
use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Student;
use App\Models\Teacher;
use App\TypeScript\TeacherClassroomStatusType;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

class ClassroomController extends Controller
{
    /**
     * Every classroom this teacher holds a subject slot in, with student
     * count and today's attendance status — the dashboard only shows
     * counts, this is what its "view classrooms" link leads to.
     */
    public function index(Request $request)
    {
        $teacher = $this->teacher($request);

        $classroomIds = $teacher->classroomSubjects()->pluck('classroom_id')->unique();

        $classrooms = Classroom::with('grade')->whereIn('id', $classroomIds)->orderBy('id')->get();

        $studentsByClassroom = Student::whereIn('classroom_id', $classrooms->pluck('id'))
            ->where('status', StudentStatus::Active)
            ->get()
            ->groupBy('classroom_id');

        $classroomsWithAttendanceToday = Attendance::whereIn('classroom_id', $classrooms->pluck('id'))
            ->whereDate('date', Carbon::today())
            ->pluck('classroom_id')
            ->unique();

        return response()->json([
            'classrooms' => $classrooms
                ->map(fn (Classroom $classroom) => TeacherClassroomStatusType::build(
                    $classroom,
                    $studentsByClassroom->get($classroom->id, collect())->count(),
                    $classroomsWithAttendanceToday->contains($classroom->id),
                ))
                ->values()
                ->all(),
        ]);
    }

    private function teacher(Request $request): Teacher
    {
        $teacher = $request->user()->teacher;
        abort_if(! $teacher, Response::HTTP_FORBIDDEN);

        return $teacher;
    }
}
