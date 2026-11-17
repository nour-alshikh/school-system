<?php

namespace App\Services\Ai\Assistant;

use App\Enums\AttendanceStatus;
use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\FeeChargeStatus;
use App\Models\Attendance;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Meeting;
use App\Models\Setting;
use App\Models\Student;
use App\TypeScript\StudentFeesSummaryType;
use Illuminate\Database\Eloquent\Builder;

/**
 * One student's own picture, for my_summary (the student) and
 * my_child_summary (their parent): recent attendance, results, fees and
 * what's coming — the same things their portal pages show.
 */
final class StudentSummary
{
    public const ATTENDANCE_DAYS = 30;

    public static function build(Student $student, ToolContext $context): array
    {
        $since = today()->subDays(self::ATTENDANCE_DAYS - 1)->toDateString();
        $records = Attendance::where('student_id', $student->id)->where('date', '>=', $since)->orderByDesc('date')->get();
        $counts = $records->countBy(fn (Attendance $a) => $a->status->value);
        $attended = ($counts['present'] ?? 0) + ($counts['late'] ?? 0);

        $summary = [
            ...Lookup::student($student),
            'attendance_last_30_days' => [
                'records' => $records->count(),
                'present' => $counts['present'] ?? 0,
                'absent' => $counts['absent'] ?? 0,
                'late' => $counts['late'] ?? 0,
                'excused' => $counts['excused'] ?? 0,
                'attendance_rate_percent' => Lookup::percent($attended, $records->count()),
                'recent_absences' => $records->where('status', AttendanceStatus::Absent)->take(5)->map(fn (Attendance $a) => $a->date->toDateString())->values()->all(),
            ],
        ];

        if ($context->hasFeature('exams')) {
            $summary['recent_results'] = ExamAttempt::with(['exam.subject', 'exam.questions'])
                ->where('student_id', $student->id)
                ->where('status', ExamAttemptStatus::Submitted)
                ->orderByDesc('submitted_at')
                ->limit(5)
                ->get()
                ->map(fn (ExamAttempt $attempt) => [
                    'exam' => $attempt->exam->title,
                    'subject' => Lookup::name($attempt->exam->subject),
                    'score' => (int) $attempt->score,
                    'total_marks' => (int) $attempt->exam->questions->sum('marks'),
                    'percent' => Lookup::percent((int) $attempt->score, (int) $attempt->exam->questions->sum('marks')),
                    'submitted_at' => $attempt->submitted_at?->toDateString(),
                ])
                ->all();

            $submitted = ExamAttempt::where('student_id', $student->id)->where('status', ExamAttemptStatus::Submitted)->pluck('exam_id');
            $summary['exams_to_take'] = self::exams($student)
                ->whereNotIn('id', $submitted)
                ->where('closes_at', '>=', now())
                ->orderBy('closes_at')
                ->limit(5)
                ->get()
                ->map(fn (Exam $exam) => ['exam' => $exam->title, 'subject' => Lookup::name($exam->subject), 'opens_at' => $exam->opens_at?->toDateTimeString(), 'closes_at' => $exam->closes_at?->toDateTimeString()])
                ->all();
        }

        if ($context->hasFeature('fees')) {
            $fees = StudentFeesSummaryType::fromCharges($student->feeCharges()->where('status', '!=', FeeChargeStatus::Waived)->get());
            $summary['fees'] = ['currency' => Setting::currency(), ...(array) $fees];
        }

        return $summary;
    }

    /** Published exams the student is eligible for (as StudentDashboardType). */
    public static function exams(Student $student): Builder
    {
        return Exam::with('subject')
            ->where('status', ExamStatus::Published)
            ->where('academic_year_id', $student->academic_year_id)
            ->where('grade_id', $student->grade_id)
            ->where(fn ($q) => $q->whereNull('classroom_id')->orWhere('classroom_id', $student->classroom_id));
    }

    /** Online lessons for the student's classroom (as StudentDashboardType). */
    public static function meetings(Student $student): Builder
    {
        return Meeting::where('academic_year_id', $student->academic_year_id)
            ->whereHas('classrooms', fn ($q) => $q->where('classroom_id', $student->classroom_id));
    }
}
