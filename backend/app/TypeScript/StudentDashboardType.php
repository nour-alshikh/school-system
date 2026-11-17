<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Models\Attendance;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\LibraryResource;
use App\Models\Meeting;
use App\Models\Setting;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The dashboard's landing summary — latest/aggregate figures, the next few
 * exams, a score trend, what's coming up and the newest library resources.
 * There's no timetable or book lending in the app, so "today's schedule" is
 * the agenda (online lessons, exams closing, calendar events) and the
 * library list is what's new for the grade (docs/design-refresh-plan.md,
 * step 4). Full history and listings live behind their own endpoints/pages
 * (see StudentPortal\AttendanceController, SubjectController,
 * FeeController) so this stays a fast, small fetch.
 */
#[TypeScript]
final class StudentDashboardType
{
    /** Submitted attempts in score_trend, newest kept. */
    public const TREND = 10;

    /** Days ahead in agenda. */
    public const AGENDA_DAYS = 7;

    public function __construct(
        public readonly StudentType $student,
        public readonly StudentAttendanceSummaryType $attendance_summary,
        public readonly ?AttendanceRecordType $latest_attendance,
        public readonly int $subjects_count,
        public readonly StudentFeesSummaryType $fees_summary,
        public readonly ?string $currency,
        public readonly int $exams_total,
        public readonly int $exams_pending_count,
        public readonly ?StudentExamListEntryType $next_exam,
        /** @var StudentExamListEntryType[] Not submitted and not closed, closing soonest first. */
        public readonly array $upcoming_exams,
        /** @var DashboardExamScoreType[] Oldest first. */
        public readonly array $score_trend,
        /** @var DashboardAgendaItemType[] */
        public readonly array $agenda,
        /** @var DashboardLibraryItemType[] */
        public readonly array $library_resources,
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
        $openExams = $pendingExams->filter(fn (Exam $exam) => $exam->closes_at->isFuture())->values();

        $scores = ExamAttempt::with(['exam.subject', 'exam.questions'])
            ->where('student_id', $student->id)
            ->where('status', ExamAttemptStatus::Submitted)
            ->whereNotNull('submitted_at')
            ->orderByDesc('submitted_at')
            ->take(self::TREND)
            ->get()
            ->reverse()
            ->map(fn (ExamAttempt $attempt) => DashboardExamScoreType::fromAttempt($attempt))
            ->values()
            ->all();

        $meetings = Meeting::where('academic_year_id', $student->academic_year_id)
            ->whereHas('classrooms', fn ($q) => $q->where('classroom_id', $student->classroom_id))
            ->whereBetween('start_time', [now()->startOfDay(), today()->addDays(self::AGENDA_DAYS)->endOfDay()])
            ->get()
            ->map(fn (Meeting $m) => DashboardAgendaItemType::forMeeting($m));

        $closing = $openExams
            ->filter(fn (Exam $exam) => $exam->opens_at->isPast() && $exam->closes_at->lte(today()->addDays(self::AGENDA_DAYS)->endOfDay()))
            ->map(fn (Exam $exam) => DashboardAgendaItemType::forExam($exam));

        return new self(
            student: StudentType::fromModel($student),
            attendance_summary: StudentAttendanceSummaryType::fromRecords($attendanceRecords),
            latest_attendance: $attendanceRecords->first()
                ? AttendanceRecordType::fromModel($attendanceRecords->first())
                : null,
            subjects_count: $subjectsCount,
            fees_summary: StudentFeesSummaryType::fromCharges($feeCharges),
            currency: Setting::currency(),
            exams_total: $exams->count(),
            exams_pending_count: $pendingExams->count(),
            next_exam: $nextExam ? StudentExamListEntryType::build($nextExam, $attemptsByExam->get($nextExam->id)) : null,
            upcoming_exams: $openExams->take(5)
                ->map(fn (Exam $exam) => StudentExamListEntryType::build($exam, $attemptsByExam->get($exam->id)))
                ->all(),
            score_trend: $scores,
            agenda: DashboardAgendaItemType::sorted($meetings->concat($closing)->concat(DashboardAgendaItemType::events(self::AGENDA_DAYS)), 8),
            library_resources: LibraryResource::where('grade_id', $student->grade_id)
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn (LibraryResource $r) => DashboardLibraryItemType::fromModel($r))
                ->all(),
        );
    }
}
