<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\StudentStatus;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Database\Eloquent\Builder;

/**
 * "How did 9-B do on the last quiz?" — an exam's results, or a summary of
 * the latest published exams. Same scope as the exams pages: every exam
 * with manage-exams, a teacher's own otherwise. Exams module only.
 */
class ExamResults extends Tool
{
    public function name(): string
    {
        return 'exam_results';
    }

    public function describe(): string
    {
        return 'exam_results(exam?: string) — with an exam title (or part of it): each student\'s status and score; without: submissions and average score of the latest published exams.';
    }

    public function allows(ToolContext $context): bool
    {
        return ($context->can('manage-exams') || $context->teacher() !== null) && $context->hasFeature('exams');
    }

    public function rules(): array
    {
        return ['exam' => ['nullable', 'string', 'max:100']];
    }

    public function run(ToolContext $context, array $args): array
    {
        $scope = fn (): Builder => Exam::with(['subject', 'grade', 'classroom', 'questions'])
            ->when(! $context->can('manage-exams'), fn ($q) => $q->where('created_by', $context->user->id));

        if (filled($args['exam'] ?? null)) {
            $escaped = addcslashes($args['exam'], '%_\\');
            $exam = $scope()->where('title', 'like', "%{$escaped}%")->orderByDesc('closes_at')->first();

            return $exam ? $this->detail($exam) : [
                'error' => "No exam you can see matches \"{$args['exam']}\".",
                'latest_exams' => $scope()->orderByDesc('id')->limit(10)->pluck('title')->all(),
            ];
        }

        $exams = $scope()->where('status', ExamStatus::Published)->orderByDesc('closes_at')->limit(5)->get();

        return [
            'source' => 'exam submissions',
            'exams' => $exams->map(fn (Exam $exam) => $this->summary($exam))->all(),
            'links' => [['href' => '/exams', 'label' => 'Exams']],
        ];
    }

    private function summary(Exam $exam): array
    {
        $total = (int) $exam->questions->sum('marks');
        $submitted = ExamAttempt::where('exam_id', $exam->id)->where('status', ExamAttemptStatus::Submitted)->get(['score']);

        return [
            'title' => $exam->title,
            'subject' => Lookup::name($exam->subject),
            'for' => $exam->classroom ? Lookup::classroomLabel($exam->classroom) : Lookup::name($exam->grade).' (whole grade)',
            'status' => $exam->status->value,
            'opens_at' => $exam->opens_at?->toDateTimeString(),
            'closes_at' => $exam->closes_at?->toDateTimeString(),
            'total_marks' => $total,
            'eligible_students' => $this->eligible($exam)->count(),
            'submitted' => $submitted->count(),
            'average_percent' => $submitted->isEmpty() ? null : Lookup::percent($submitted->avg('score'), $total),
        ];
    }

    private function detail(Exam $exam): array
    {
        $total = (int) $exam->questions->sum('marks');
        $students = $this->eligible($exam)->with('classroom.grade')->get();
        $attempts = ExamAttempt::where('exam_id', $exam->id)->whereIn('student_id', $students->pluck('id'))->get()->keyBy('student_id');

        return [
            'source' => 'exam submissions',
            ...$this->summary($exam),
            'students' => $students->take(60)->map(function (Student $student) use ($attempts, $total) {
                $attempt = $attempts->get($student->id);
                $submitted = $attempt?->status === ExamAttemptStatus::Submitted;

                return [
                    ...Lookup::student($student),
                    'status' => $attempt ? $attempt->status->value : 'not_started',
                    'score' => $submitted ? (int) $attempt->score : null,
                    'percent' => $submitted ? Lookup::percent((int) $attempt->score, $total) : null,
                ];
            })->all(),
            'links' => [['href' => "/exams/{$exam->id}/results", 'label' => $exam->title]],
        ];
    }

    /** As ExamController::eligibleStudents(). */
    private function eligible(Exam $exam): Builder
    {
        return Student::where('academic_year_id', $exam->academic_year_id)
            ->where('grade_id', $exam->grade_id)
            ->where('status', StudentStatus::Active)
            ->when($exam->classroom_id !== null, fn ($q) => $q->where('classroom_id', $exam->classroom_id))
            ->orderBy('id');
    }
}
