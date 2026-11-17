<?php

namespace App\TypeScript;

use App\Enums\AttendanceStatus;
use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\StudentStatus;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\ClassroomSubjectTeacher;
use App\Models\Exam;
use App\Models\Meeting;
use App\Models\Setting;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * A teacher's dashboard: today's classrooms with their attendance status,
 * open exams with submission progress, class averages on recent exams, and
 * what's coming up. There's no timetable, so "today's classes" are all the
 * teacher's classrooms (on a school day); exams are auto-marked, so open
 * exams take the place of a grading queue (docs/design-refresh-plan.md,
 * step 4). Full listings live behind their own endpoints/pages.
 */
#[TypeScript]
final class TeacherDashboardType
{
    /** Closed exams in exam_results, newest kept. */
    public const RESULTS = 8;

    /** Days ahead in agenda. */
    public const AGENDA_DAYS = 14;

    public function __construct(
        public readonly TeacherType $teacher,
        public readonly int $classrooms_count,
        public readonly int $subjects_count,
        public readonly int $students_total,
        public readonly int $attendance_marked_count,
        public readonly int $exams_total,
        public readonly ?TeacherExamSummaryType $latest_exam,
        public readonly bool $is_school_day,
        /** @var TeacherDashboardClassroomType[] With students before empty, then unmarked first. */
        public readonly array $classrooms,
        /** @var TeacherExamSummaryType[] Published and not closed yet, closing soonest first. */
        public readonly array $open_exams,
        /** @var TeacherDashboardExamResultType[] Oldest first, for the chart. */
        public readonly array $exam_results,
        /** @var DashboardAgendaItemType[] */
        public readonly array $agenda,
    ) {}

    public static function build(Teacher $teacher): self
    {
        $assignments = $teacher->classroomSubjects()->with('subject')->get();
        $classroomIds = $assignments->pluck('classroom_id')->unique()->values();

        $studentCounts = Student::whereIn('classroom_id', $classroomIds)
            ->where('status', StudentStatus::Active)
            ->selectRaw('classroom_id, count(*) as n')
            ->groupBy('classroom_id')
            ->toBase()
            ->pluck('n', 'classroom_id');

        $today = Attendance::whereIn('classroom_id', $classroomIds)
            ->whereDate('date', Carbon::today())
            ->selectRaw('classroom_id, status, count(*) as n')
            ->groupBy('classroom_id', 'status')
            ->toBase()
            ->get()
            ->groupBy('classroom_id');

        $examsQuery = Exam::where('created_by', $teacher->user_id);
        $latestExam = (clone $examsQuery)->with(['subject', 'attempts'])->orderByDesc('id')->first();

        $schoolDays = Setting::schoolDays();

        return new self(
            teacher: TeacherType::fromModel($teacher),
            classrooms_count: $classroomIds->count(),
            subjects_count: $assignments->pluck('subject_id')->unique()->count(),
            students_total: (int) $studentCounts->sum(),
            attendance_marked_count: $today->count(),
            exams_total: (clone $examsQuery)->count(),
            latest_exam: $latestExam ? TeacherExamSummaryType::build($latestExam, self::eligibleCount($latestExam)) : null,
            is_school_day: $schoolDays === null || in_array(today()->dayOfWeek, $schoolDays, true),
            classrooms: self::classrooms($assignments, $studentCounts, $today),
            open_exams: (clone $examsQuery)->with(['subject', 'attempts'])
                ->where('status', ExamStatus::Published)
                ->where('closes_at', '>=', now())
                ->orderBy('closes_at')
                ->take(5)
                ->get()
                ->map(fn (Exam $exam) => TeacherExamSummaryType::build($exam, self::eligibleCount($exam)))
                ->all(),
            exam_results: self::examResults(clone $examsQuery),
            agenda: self::agenda($teacher),
        );
    }

    /**
     * @param  Collection<int, ClassroomSubjectTeacher>  $assignments
     * @return list<TeacherDashboardClassroomType>
     */
    private static function classrooms(Collection $assignments, Collection $studentCounts, Collection $today): array
    {
        $classrooms = Classroom::with('grade')->whereIn('id', $assignments->pluck('classroom_id'))->get();
        $subjects = $assignments->groupBy('classroom_id');

        return $classrooms
            ->map(function (Classroom $classroom) use ($subjects, $studentCounts, $today) {
                $counts = collect($today->get($classroom->id, []))->pluck('n', 'status');
                $mine = $subjects->get($classroom->id, collect())->pluck('subject')->unique('id');

                return new TeacherDashboardClassroomType(
                    id: $classroom->id,
                    name: $classroom->name,
                    grade_name_en: $classroom->grade->getTranslation('name', 'en'),
                    grade_name_ar: $classroom->grade->getTranslation('name', 'ar'),
                    subjects_en: $mine->map(fn ($s) => $s->getTranslation('name', 'en'))->values()->all(),
                    subjects_ar: $mine->map(fn ($s) => $s->getTranslation('name', 'ar'))->values()->all(),
                    students_count: (int) $studentCounts->get($classroom->id, 0),
                    marked_today: $counts->isNotEmpty(),
                    present_today: (int) $counts->get(AttendanceStatus::Present->value, 0) + (int) $counts->get(AttendanceStatus::Late->value, 0),
                    absent_today: (int) $counts->get(AttendanceStatus::Absent->value, 0),
                );
            })
            // Classrooms with students before empty ones, then not marked yet first.
            ->sortBy([
                fn (TeacherDashboardClassroomType $a, TeacherDashboardClassroomType $b) => ($a->students_count === 0) <=> ($b->students_count === 0),
                ['marked_today', 'asc'],
                ['name', 'asc'],
            ])
            ->values()
            ->all();
    }

    /** @return list<TeacherDashboardExamResultType> */
    private static function examResults($examsQuery): array
    {
        return $examsQuery->with(['subject', 'questions', 'attempts' => fn ($q) => $q->where('status', ExamAttemptStatus::Submitted)])
            ->where('status', ExamStatus::Published)
            ->where('closes_at', '<', now())
            ->orderByDesc('closes_at')
            ->take(self::RESULTS)
            ->get()
            ->reverse()
            ->map(function (Exam $exam) {
                $total = (int) $exam->questions->sum('marks');
                $scores = $exam->attempts->pluck('score')->filter(fn ($s) => $s !== null);

                return new TeacherDashboardExamResultType(
                    id: $exam->id,
                    title: $exam->title,
                    subject_name_en: $exam->subject->getTranslation('name', 'en'),
                    subject_name_ar: $exam->subject->getTranslation('name', 'ar'),
                    closes_at: $exam->closes_at->toJSON(),
                    submitted_count: $exam->attempts->count(),
                    eligible_count: self::eligibleCount($exam),
                    average_percent: $total > 0 && $scores->isNotEmpty() ? round($scores->avg() / $total * 100, 1) : null,
                );
            })
            ->values()
            ->all();
    }

    /** @return list<DashboardAgendaItemType> The teacher's online lessons and the school calendar. */
    private static function agenda(Teacher $teacher): array
    {
        $meetings = Meeting::where('created_by', $teacher->user_id)
            ->whereBetween('start_time', [now()->startOfDay(), today()->addDays(self::AGENDA_DAYS)->endOfDay()])
            ->get()
            ->map(fn (Meeting $m) => DashboardAgendaItemType::forMeeting($m));

        return DashboardAgendaItemType::sorted($meetings->concat(DashboardAgendaItemType::events(self::AGENDA_DAYS)), 6);
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
