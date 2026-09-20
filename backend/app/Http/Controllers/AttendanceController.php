<?php

namespace App\Http\Controllers;

use App\Enums\StudentStatus;
use App\Http\Requests\Attendance\StoreAttendanceRequest;
use App\Http\Resources\ClassroomResource;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Student;
use App\TypeScript\AttendanceRosterEntryType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class AttendanceController extends Controller
{
    /**
     * Which classrooms the current user may mark attendance for — an admin
     * (manage-attendance) gets every classroom, same as the /classrooms
     * endpoint; a teacher gets only the ones they hold a subject slot in
     * (see Teacher::classroomSubjects). Deliberately its own endpoint
     * rather than reusing GET /classrooms, which is gated on
     * manage-academics|manage-students — permissions the teacher role
     * doesn't and shouldn't have.
     */
    public function classrooms(Request $request)
    {
        $user = $request->user();
        $query = Classroom::with('grade')->orderBy('id');

        if (! $user->can('manage-attendance')) {
            $teacher = $user->teacher;
            abort_if(! $teacher, Response::HTTP_FORBIDDEN);

            $query->whereIn('id', $teacher->classroomSubjects()->pluck('classroom_id'));
        }

        return response()->json(['classrooms' => ClassroomResource::collection($query->get())]);
    }

    public function index(Request $request, Classroom $classroom)
    {
        $this->authorizeClassroom($request, $classroom);

        $date = $request->query('date', now()->toDateString());

        $students = Student::where('classroom_id', $classroom->id)
            ->where('status', StudentStatus::Active)
            ->orderBy('id')
            ->get();

        $existingByStudent = Attendance::where('classroom_id', $classroom->id)
            ->whereDate('date', $date)
            ->get()
            ->keyBy('student_id');

        $roster = $students
            ->map(fn (Student $student) => AttendanceRosterEntryType::build($student, $existingByStudent->get($student->id)))
            ->values()
            ->all();

        return response()->json(['roster' => $roster, 'date' => $date]);
    }

    /**
     * Bulk upsert for one classroom+date — one row per student in the
     * marking screen, saved together. Re-saving the same date just updates
     * the existing rows (attendances.student_id+date is unique).
     */
    public function store(StoreAttendanceRequest $request, Classroom $classroom)
    {
        $this->authorizeClassroom($request, $classroom);

        $data = $request->validated();

        $classroomStudents = Student::where('classroom_id', $classroom->id)
            ->whereIn('id', collect($data['records'])->pluck('student_id'))
            ->get()
            ->keyBy('id');

        $unknown = collect($data['records'])->pluck('student_id')->diff($classroomStudents->keys());
        abort_if($unknown->isNotEmpty(), Response::HTTP_UNPROCESSABLE_ENTITY, 'One or more students are not in this classroom.');

        DB::transaction(function () use ($data, $classroom, $classroomStudents, $request) {
            foreach ($data['records'] as $record) {
                Attendance::updateOrCreate(
                    ['student_id' => $record['student_id'], 'date' => $data['date']],
                    [
                        'classroom_id' => $classroom->id,
                        'academic_year_id' => $classroomStudents[$record['student_id']]->academic_year_id,
                        'status' => $record['status'],
                        'notes' => $record['notes'] ?? null,
                        'recorded_by' => $request->user()->id,
                    ]
                );
            }
        });

        return response()->json(['saved_count' => count($data['records'])], 201);
    }

    private function authorizeClassroom(Request $request, Classroom $classroom): void
    {
        $user = $request->user();

        if ($user->can('manage-attendance')) {
            return;
        }

        $teacher = $user->teacher;

        abort_if(
            ! $teacher || ! $teacher->classroomSubjects()->where('classroom_id', $classroom->id)->exists(),
            Response::HTTP_FORBIDDEN
        );
    }
}
