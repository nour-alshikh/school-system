<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Models\Attendance;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Setting;
use App\Models\Student;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * One child on the parent dashboard. Built inside the child's school
 * context (see ParentPortal\StudentController::index), so the agenda is
 * that school's calendar.
 */
#[TypeScript]
final class ParentChildType
{
    /** Newest submitted results in latest_scores. */
    public const SCORES = 5;

    /** Days ahead in agenda. */
    public const AGENDA_DAYS = 14;

    public function __construct(
        public readonly StudentType $student,
        public readonly int $school_id,
        public readonly string $school_name,
        public readonly StudentAttendanceSummaryType $attendance,
        public readonly StudentFeesSummaryType $fees,
        /** This child's school's, which may differ between children. */
        public readonly ?string $currency,
        /** @var DashboardExamScoreType[] Newest first. */
        public readonly array $latest_scores,
        /** @var DashboardAgendaItemType[] The school calendar and exams this child still has to take. */
        public readonly array $agenda,
    ) {}

    public static function fromModel(Student $student): self
    {
        $attendance = Attendance::where('student_id', $student->id)
            ->where('academic_year_id', $student->academic_year_id)
            ->get();

        $scores = ExamAttempt::with(['exam.subject', 'exam.questions'])
            ->where('student_id', $student->id)
            ->where('status', ExamAttemptStatus::Submitted)
            ->whereNotNull('submitted_at')
            ->orderByDesc('submitted_at')
            ->take(self::SCORES)
            ->get();

        return new self(
            student: StudentType::fromModel($student),
            school_id: $student->school_id,
            school_name: $student->school->name,
            attendance: StudentAttendanceSummaryType::fromRecords($attendance),
            fees: StudentFeesSummaryType::fromCharges($student->feeCharges()->with('payments')->get()),
            currency: Setting::currency(),
            latest_scores: $scores->map(fn (ExamAttempt $a) => DashboardExamScoreType::fromAttempt($a))->all(),
            agenda: DashboardAgendaItemType::sorted(
                self::examsToTake($student)->concat(DashboardAgendaItemType::events(self::AGENDA_DAYS)),
                6,
            ),
        );
    }

    /** Open exams for the child's grade/classroom, closing within a week, not submitted yet. */
    private static function examsToTake(Student $student)
    {
        $submitted = ExamAttempt::where('student_id', $student->id)
            ->where('status', ExamAttemptStatus::Submitted)
            ->pluck('exam_id');

        return Exam::with('subject')
            ->where('status', ExamStatus::Published)
            ->where('academic_year_id', $student->academic_year_id)
            ->where('grade_id', $student->grade_id)
            ->where(fn ($q) => $q->whereNull('classroom_id')->orWhere('classroom_id', $student->classroom_id))
            ->where('opens_at', '<=', now())
            ->whereBetween('closes_at', [now(), today()->addDays(7)->endOfDay()])
            ->whereNotIn('id', $submitted)
            ->get()
            ->map(fn (Exam $exam) => DashboardAgendaItemType::forExam($exam));
    }
}
