<?php

namespace App\TypeScript;

use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Exam;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Support\Carbon;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class TeacherDashboardType
{
    public function __construct(
        public readonly TeacherType $teacher,
        /** @var ExamTeachingAssignmentType[] */
        public readonly array $assignments,
        public readonly int $students_total,
        /** @var TeacherClassroomStatusType[] */
        public readonly array $classrooms,
        /** @var TeacherExamSummaryType[] */
        public readonly array $exams,
    ) {}

    public static function build(Teacher $teacher): self
    {
        $assignments = $teacher->classroomSubjects()->with(['classroom.grade', 'subject'])->get();

        $classrooms = Classroom::with('grade')
            ->whereIn('id', $assignments->pluck('classroom_id')->unique())
            ->get();

        $studentsByClassroom = Student::whereIn('classroom_id', $classrooms->pluck('id'))
            ->where('status', StudentStatus::Active)
            ->get()
            ->groupBy('classroom_id');

        $today = Carbon::today();
        $classroomsWithAttendanceToday = Attendance::whereIn('classroom_id', $classrooms->pluck('id'))
            ->whereDate('date', $today)
            ->pluck('classroom_id')
            ->unique();

        $exams = Exam::with(['subject', 'attempts'])
            ->where('created_by', $teacher->user_id)
            ->orderByDesc('id')
            ->take(5)
            ->get();

        return new self(
            teacher: TeacherType::fromModel($teacher),
            assignments: $assignments
                ->map(fn ($assignment) => ExamTeachingAssignmentType::fromModel($assignment))
                ->values()
                ->all(),
            students_total: $studentsByClassroom->flatten()->unique('id')->count(),
            classrooms: $classrooms
                ->map(fn (Classroom $classroom) => TeacherClassroomStatusType::build(
                    $classroom,
                    $studentsByClassroom->get($classroom->id, collect())->count(),
                    $classroomsWithAttendanceToday->contains($classroom->id),
                ))
                ->values()
                ->all(),
            exams: $exams
                ->map(fn (Exam $exam) => TeacherExamSummaryType::build($exam, self::eligibleCount($exam)))
                ->values()
                ->all(),
        );
    }

    /**
     * Mirrors ExamController::eligibleStudents() — kept as its own small
     * query here rather than shared, same "each controller/type resolves
     * its own scope" convention as StudentPortal\ExamController's private
     * student().
     */
    private static function eligibleCount(Exam $exam): int
    {
        $query = Student::where('academic_year_id', $exam->academic_year_id)
            ->where('grade_id', $exam->grade_id)
            ->where('status', StudentStatus::Active);

        if ($exam->classroom_id !== null) {
            $query->where('classroom_id', $exam->classroom_id);
        }

        return $query->count();
    }
}
