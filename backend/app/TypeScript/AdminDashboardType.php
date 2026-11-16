<?php

namespace App\TypeScript;

use App\Enums\AttendanceStatus;
use App\Enums\ExamStatus;
use App\Enums\FeeChargeStatus;
use App\Enums\StudentStatus;
use App\Enums\TeacherStatus;
use App\Models\AcademicYear;
use App\Models\Attendance;
use App\Models\Classroom;
use App\Models\Exam;
use App\Models\FeeCharge;
use App\Models\FeePayment;
use App\Models\LibraryResource;
use App\Models\Meeting;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The admin dashboard: headline counts plus the trend and attention data
 * its charts and panels draw from. Each part is one grouped query (or a
 * small capped one); bucketing by day/month happens in PHP so the SQL stays
 * portable across SQLite and MySQL.
 */
#[TypeScript]
final class AdminDashboardType
{
    /** Days of attendance history in attendance_trend (today included). */
    public const TREND_DAYS = 30;

    /** Months of history in fees_by_month / enrollments_by_month (this month included). */
    public const MONTHS = 6;

    /** A student is "low attendance" below this rate over TREND_DAYS… */
    public const LOW_ATTENDANCE_RATE = 0.75;

    /** …once they have at least this many records in the window. */
    public const LOW_ATTENDANCE_MIN_RECORDS = 5;

    public function __construct(
        public readonly int $students_count,
        public readonly int $teachers_count,
        public readonly int $parents_count,
        public readonly int $classrooms_count,
        public readonly ?int $current_academic_year,
        public readonly string $fees_collected,
        public readonly string $fees_outstanding,
        public readonly int $attendance_present_today,
        public readonly int $attendance_marked_today,
        public readonly int $upcoming_meetings_count,
        public readonly int $library_resources_count,
        /** @var AdminDashboardAttendanceDayType[] */
        public readonly array $attendance_trend,
        /** @var AdminDashboardFeeMonthType[] */
        public readonly array $fees_by_month,
        /** @var AdminDashboardMonthCountType[] */
        public readonly array $enrollments_by_month,
        /** @var AdminDashboardStageCountType[] */
        public readonly array $students_by_stage,
        public readonly int $overdue_students_count,
        /** @var AdminDashboardOverdueType[] */
        public readonly array $top_overdue,
        public readonly bool $is_school_day,
        /** @var AdminDashboardClassroomRefType[] */
        public readonly array $classrooms_unmarked_today,
        public readonly int $low_attendance_students_count,
        /** @var AdminDashboardExamType[] */
        public readonly array $upcoming_exams,
        /** @var AdminDashboardActivityType[] */
        public readonly array $recent_activity,
    ) {}

    public static function build(): self
    {
        $totalDue = (float) FeeCharge::where('status', '!=', FeeChargeStatus::Waived)->sum('amount_due');
        $collected = (float) FeePayment::sum('amount');
        [$overdueCount, $topOverdue] = self::overdue();
        $schoolDays = Setting::schoolDays();
        $isSchoolDay = $schoolDays === null || in_array(today()->dayOfWeek, $schoolDays, true);

        return new self(
            students_count: Student::where('status', StudentStatus::Active)->count(),
            teachers_count: Teacher::where('status', TeacherStatus::Active)->count(),
            parents_count: User::role('parent')->count(),
            classrooms_count: Classroom::count(),
            current_academic_year: AcademicYear::where('is_current', true)->value('year'),
            fees_collected: self::money($collected),
            fees_outstanding: self::money(max(0, $totalDue - $collected)),
            attendance_present_today: Attendance::whereDate('date', today())
                ->where('status', AttendanceStatus::Present)
                ->count(),
            attendance_marked_today: Attendance::whereDate('date', today())->count(),
            upcoming_meetings_count: Meeting::where('start_time', '>=', now())->count(),
            library_resources_count: LibraryResource::count(),
            attendance_trend: self::attendanceTrend(),
            fees_by_month: self::feesByMonth(),
            enrollments_by_month: self::enrollmentsByMonth(),
            students_by_stage: self::studentsByStage(),
            overdue_students_count: $overdueCount,
            top_overdue: $topOverdue,
            is_school_day: $isSchoolDay,
            classrooms_unmarked_today: $isSchoolDay ? self::classroomsUnmarkedToday() : [],
            low_attendance_students_count: self::lowAttendanceCount(),
            upcoming_exams: self::upcomingExams(),
            recent_activity: self::recentActivity(),
        );
    }

    /** @return AdminDashboardAttendanceDayType[] */
    private static function attendanceTrend(): array
    {
        $start = today()->subDays(self::TREND_DAYS - 1);

        // Group in SQL by (date, status), then key by the date's first ten
        // characters — the column may hold "Y-m-d" or "Y-m-d 00:00:00"
        // depending on how the row was written.
        $counts = Attendance::where('date', '>=', $start->toDateString())
            ->selectRaw('date, status, count(*) as n')
            ->groupBy('date', 'status')
            ->toBase()
            ->get()
            ->groupBy(fn ($row) => substr((string) $row->date, 0, 10))
            ->map(fn (Collection $rows) => $rows->groupBy('status')->map(fn ($r) => (int) $r->sum('n')));

        return collect(range(0, self::TREND_DAYS - 1))->map(function (int $i) use ($start, $counts) {
            $date = $start->copy()->addDays($i)->toDateString();
            $day = $counts->get($date, collect());

            return new AdminDashboardAttendanceDayType(
                date: $date,
                present: $day->get(AttendanceStatus::Present->value, 0),
                late: $day->get(AttendanceStatus::Late->value, 0),
                absent: $day->get(AttendanceStatus::Absent->value, 0),
                excused: $day->get(AttendanceStatus::Excused->value, 0),
            );
        })->all();
    }

    /** @return AdminDashboardFeeMonthType[] */
    private static function feesByMonth(): array
    {
        $since = now()->startOfMonth()->subMonths(self::MONTHS - 1);

        $collected = FeePayment::where('paid_at', '>=', $since->toDateString())
            ->toBase()
            ->get(['paid_at', 'amount'])
            ->groupBy(fn ($p) => substr((string) $p->paid_at, 0, 7))
            ->map(fn (Collection $rows) => $rows->sum(fn ($p) => (float) $p->amount));

        $charged = FeeCharge::where('status', '!=', FeeChargeStatus::Waived)
            ->where('created_at', '>=', $since)
            ->toBase()
            ->get(['created_at', 'amount_due'])
            ->groupBy(fn ($c) => substr((string) $c->created_at, 0, 7))
            ->map(fn (Collection $rows) => $rows->sum(fn ($c) => (float) $c->amount_due));

        return self::months($since)->map(fn (string $month) => new AdminDashboardFeeMonthType(
            month: $month,
            charged: self::money($charged->get($month, 0)),
            collected: self::money($collected->get($month, 0)),
        ))->all();
    }

    /** @return AdminDashboardMonthCountType[] */
    private static function enrollmentsByMonth(): array
    {
        $since = now()->startOfMonth()->subMonths(self::MONTHS - 1);

        $counts = Student::where('created_at', '>=', $since)
            ->toBase()
            ->pluck('created_at')
            ->countBy(fn ($at) => substr((string) $at, 0, 7));

        return self::months($since)->map(fn (string $month) => new AdminDashboardMonthCountType(
            month: $month,
            count: $counts->get($month, 0),
        ))->all();
    }

    /** @return AdminDashboardStageCountType[] */
    private static function studentsByStage(): array
    {
        $counts = Student::where('status', StudentStatus::Active)
            ->whereNotNull('stage_id')
            ->selectRaw('stage_id, count(*) as n')
            ->groupBy('stage_id')
            ->toBase()
            ->pluck('n', 'stage_id');

        return Stage::orderBy('id')->get()
            ->map(fn (Stage $stage) => new AdminDashboardStageCountType(
                stage_id: $stage->id,
                name_en: $stage->getTranslation('name', 'en'),
                name_ar: $stage->getTranslation('name', 'ar'),
                count: (int) $counts->get($stage->id, 0),
            ))
            ->all();
    }

    /**
     * Students with an unpaid balance on any non-waived charge: how many,
     * and the five owing the most.
     *
     * @return array{0: int, 1: AdminDashboardOverdueType[]}
     */
    private static function overdue(): array
    {
        $balances = FeeCharge::whereIn('status', [FeeChargeStatus::Unpaid, FeeChargeStatus::Partial])
            ->withSum('payments', 'amount')
            ->get(['id', 'student_id', 'amount_due'])
            ->groupBy('student_id')
            ->map(fn (Collection $charges) => $charges->sum(
                fn (FeeCharge $c) => max(0, (float) $c->amount_due - (float) $c->payments_sum_amount)
            ))
            ->filter(fn (float $owed) => $owed > 0)
            ->sortDesc();

        $students = Student::whereIn('id', $balances->keys()->take(5))->get()->keyBy('id');

        $top = $balances->take(5)
            ->map(fn (float $owed, int $studentId) => ($student = $students->get($studentId))
                ? new AdminDashboardOverdueType(
                    student_id: $studentId,
                    name_en: $student->getTranslation('name', 'en'),
                    name_ar: $student->getTranslation('name', 'ar'),
                    outstanding: self::money($owed),
                )
                : null)
            ->filter()
            ->values()
            ->all();

        return [$balances->count(), $top];
    }

    /**
     * Classrooms with active students and no attendance recorded today.
     *
     * @return AdminDashboardClassroomRefType[]
     */
    private static function classroomsUnmarkedToday(): array
    {
        $marked = Attendance::whereDate('date', today())->distinct()->pluck('classroom_id');

        return Classroom::with('grade')
            ->whereNotIn('id', $marked)
            ->whereHas('students', fn ($q) => $q->where('status', StudentStatus::Active))
            ->orderBy('grade_id')
            ->orderBy('name')
            ->get()
            ->map(fn (Classroom $c) => new AdminDashboardClassroomRefType(
                id: $c->id,
                name: $c->name,
                grade_name_en: $c->grade?->getTranslation('name', 'en') ?? '',
                grade_name_ar: $c->grade?->getTranslation('name', 'ar') ?? '',
            ))
            ->all();
    }

    private static function lowAttendanceCount(): int
    {
        $attended = implode("','", [AttendanceStatus::Present->value, AttendanceStatus::Late->value]);

        return Attendance::where('date', '>=', today()->subDays(self::TREND_DAYS - 1)->toDateString())
            ->whereHas('student', fn ($q) => $q->where('status', StudentStatus::Active))
            ->selectRaw("student_id, count(*) as total, sum(case when status in ('{$attended}') then 1 else 0 end) as attended")
            ->groupBy('student_id')
            ->toBase()
            ->get()
            ->filter(fn ($row) => (int) $row->total >= self::LOW_ATTENDANCE_MIN_RECORDS
                && ((int) $row->attended / (int) $row->total) < self::LOW_ATTENDANCE_RATE)
            ->count();
    }

    /** @return AdminDashboardExamType[] */
    private static function upcomingExams(): array
    {
        return Exam::with(['subject', 'grade', 'classroom'])
            ->where('status', ExamStatus::Published)
            ->where('opens_at', '>=', now())
            ->orderBy('opens_at')
            ->limit(5)
            ->get()
            ->map(fn (Exam $exam) => new AdminDashboardExamType(
                id: $exam->id,
                title: $exam->title,
                opens_at: $exam->opens_at->toJSON(),
                subject_name_en: $exam->subject?->getTranslation('name', 'en') ?? '',
                subject_name_ar: $exam->subject?->getTranslation('name', 'ar') ?? '',
                grade_name_en: $exam->grade?->getTranslation('name', 'en') ?? '',
                grade_name_ar: $exam->grade?->getTranslation('name', 'ar') ?? '',
                classroom_name: $exam->classroom?->name,
            ))
            ->all();
    }

    /**
     * The latest payments, enrollments and exams, merged newest first.
     *
     * @return AdminDashboardActivityType[]
     */
    private static function recentActivity(): array
    {
        $limit = 8;

        $payments = FeePayment::with('feeCharge.student')->latest('created_at')->latest('id')->limit($limit)->get()
            ->map(fn (FeePayment $p) => new AdminDashboardActivityType(
                type: 'payment',
                subject_id: $p->feeCharge?->student_id ?? 0,
                label_en: $p->feeCharge?->student?->getTranslation('name', 'en') ?? '',
                label_ar: $p->feeCharge?->student?->getTranslation('name', 'ar') ?? '',
                amount: self::money($p->amount),
                at: $p->created_at->toJSON(),
            ));

        $students = Student::latest('created_at')->latest('id')->limit($limit)->get()
            ->map(fn (Student $s) => new AdminDashboardActivityType(
                type: 'student',
                subject_id: $s->id,
                label_en: $s->getTranslation('name', 'en'),
                label_ar: $s->getTranslation('name', 'ar'),
                amount: null,
                at: $s->created_at->toJSON(),
            ));

        $exams = Exam::latest('created_at')->latest('id')->limit($limit)->get()
            ->map(fn (Exam $e) => new AdminDashboardActivityType(
                type: 'exam',
                subject_id: $e->id,
                label_en: $e->title,
                label_ar: $e->title,
                amount: null,
                at: $e->created_at->toJSON(),
            ));

        return $payments->concat($students)->concat($exams)
            ->sortByDesc('at')
            ->take($limit)
            ->values()
            ->all();
    }

    /** "YYYY-MM" for each of the MONTHS months starting at $since. */
    private static function months(Carbon $since): Collection
    {
        return collect(range(0, self::MONTHS - 1))
            ->map(fn (int $i) => $since->copy()->addMonths($i)->format('Y-m'));
    }

    private static function money(float|int|string $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }
}
