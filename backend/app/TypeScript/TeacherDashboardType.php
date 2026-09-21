<?php

namespace App\TypeScript;

use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\Exam;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Support\Carbon;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The dashboard's landing summary — counts and the latest exam only. Full
 * classroom listings and exams live behind their own endpoints/pages (see
 * TeacherPortal\ClassroomController and the shared /api/exams list) so this
 * stays a fast, small fetch.
 */
#[TypeScript]
final class TeacherDashboardType
{
    public function __construct(
        public readonly TeacherType $teacher,
        public readonly int $classrooms_count,
        public readonly int $subjects_count,
        public readonly int $students_total,
        public readonly int $attendance_marked_count,
        public readonly int $exams_total,
        public readonly ?TeacherExamSummaryType $latest_exam,
    ) {}

    public static function build(Teacher $teacher): self
    {
        $assignments = $teacher->classroomSubjects()->get();
        $classroomIds = $assignments->pluck('classroom_id')->unique();

        $studentsTotal = Student::whereIn('classroom_id', $classroomIds)
            ->where('status', StudentStatus::Active)
            ->count();

        $attendanceMarkedCount = Attendance::whereIn('classroom_id', $classroomIds)
            ->whereDate('date', Carbon::today())
            ->distinct('classroom_id')
            ->count('classroom_id');

        $examsQuery = Exam::where('created_by', $teacher->user_id);
        $latestExam = (clone $examsQuery)->with(['subject', 'attempts'])->orderByDesc('id')->first();

        return new self(
            teacher: TeacherType::fromModel($teacher),
            classrooms_count: $classroomIds->count(),
            subjects_count: $assignments->pluck('subject_id')->unique()->count(),
            students_total: $studentsTotal,
            attendance_marked_count: $attendanceMarkedCount,
            exams_total: $examsQuery->count(),
            latest_exam: $latestExam ? TeacherExamSummaryType::build($latestExam, self::eligibleCount($latestExam)) : null,
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
