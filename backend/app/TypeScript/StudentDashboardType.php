<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Models\Attendance;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The dashboard's landing summary — latest/aggregate figures only. Full
 * history and listings live behind their own endpoints/pages (see
 * StudentPortal\AttendanceController, SubjectController, FeeController) so
 * this stays a fast, small fetch.
 */
#[TypeScript]
final class StudentDashboardType
{
    public function __construct(
        public readonly StudentType $student,
        public readonly StudentAttendanceSummaryType $attendance_summary,
        public readonly ?AttendanceRecordType $latest_attendance,
        public readonly int $subjects_count,
        public readonly StudentFeesSummaryType $fees_summary,
        public readonly int $exams_total,
        public readonly int $exams_pending_count,
        public readonly ?StudentExamListEntryType $next_exam,
    ) {}

    public static function build(Student $student): self
    {
        $attendanceRecords = Attendance::with('student')
            ->where('student_id', $student->id)
            ->where('academic_year_id', $student->academic_year_id)
            ->orderByDesc('date')
            ->get();

        $subjectsCount = $student->classroom ? $student->classroom->subjectTeachers()->count() : 0;

        $feeCharges = $student->feeCharges;

        // Mirrors StudentPortal\ExamController::index()'s eligibility query —
        // kept as its own small query here rather than shared, same
        // "each controller/type resolves its own scope" convention as
        // TeacherDashboardType::eligibleCount().
        $exams = Exam::with(['subject', 'questions'])
            ->where('status', ExamStatus::Published)
            ->where('academic_year_id', $student->academic_year_id)
            ->where('grade_id', $student->grade_id)
            ->where(fn ($q) => $q->whereNull('classroom_id')->orWhere('classroom_id', $student->classroom_id))
            ->get();

        $attemptsByExam = ExamAttempt::where('student_id', $student->id)
            ->whereIn('exam_id', $exams->pluck('id'))
            ->get()
            ->keyBy('exam_id');

        $pendingExams = $exams
            ->reject(fn (Exam $exam) => $attemptsByExam->get($exam->id)?->status === ExamAttemptStatus::Submitted)
            ->sortBy('closes_at');

        $nextExam = $pendingExams->first();

        return new self(
            student: StudentType::fromModel($student),
            attendance_summary: StudentAttendanceSummaryType::fromRecords($attendanceRecords),
            latest_attendance: $attendanceRecords->first()
                ? AttendanceRecordType::fromModel($attendanceRecords->first())
                : null,
            subjects_count: $subjectsCount,
            fees_summary: StudentFeesSummaryType::fromCharges($feeCharges),
            exams_total: $exams->count(),
            exams_pending_count: $pendingExams->count(),
            next_exam: $nextExam ? StudentExamListEntryType::build($nextExam, $attemptsByExam->get($nextExam->id)) : null,
        );
    }
}
