<?php

namespace App\Http\Controllers\StudentPortal;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ExamAttempt\SubmitExamAttemptRequest;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\Student;
use App\TypeScript\StudentExamAttemptType;
use App\TypeScript\StudentExamListEntryType;
use App\TypeScript\StudentExamResultType;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ExamController extends Controller
{
    /**
     * Every published exam targeting this student's grade (or their
     * specific classroom within it) for their current academic year,
     * paired with their own attempt if they've started/finished one — see
     * StudentExamListEntryType. Score is included once submitted; the
     * per-question answer key never is (see StudentExamOptionType).
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $exams = Exam::with(['subject', 'questions'])
            ->where('status', ExamStatus::Published)
            ->where('academic_year_id', $student->academic_year_id)
            ->where('grade_id', $student->grade_id)
            ->where(fn ($q) => $q->whereNull('classroom_id')->orWhere('classroom_id', $student->classroom_id))
            ->orderByDesc('opens_at')
            ->get();

        $attemptsByExam = ExamAttempt::where('student_id', $student->id)
            ->whereIn('exam_id', $exams->pluck('id'))
            ->get()
            ->keyBy('exam_id');

        $rows = $exams
            ->map(fn (Exam $exam) => StudentExamListEntryType::build($exam, $attemptsByExam->get($exam->id)))
            ->values()
            ->all();

        return response()->json(['exams' => $rows]);
    }

    /**
     * Starts (or resumes) this student's one attempt. Creating the attempt
     * row here rather than a separate "start" endpoint keeps the frontend
     * to a single fetch-and-go call, same as how AttendanceController's
     * index() doubles as "load whatever exists for this date."
     */
    public function show(Request $request, Exam $exam)
    {
        $student = $this->student($request);
        $this->authorizeEligible($exam, $student);

        $attempt = ExamAttempt::where('exam_id', $exam->id)->where('student_id', $student->id)->first();

        abort_if($attempt?->status === ExamAttemptStatus::Submitted, Response::HTTP_CONFLICT, 'This exam has already been submitted.');

        $now = Carbon::now();

        if ($attempt) {
            $deadline = $this->deadline($exam, $attempt);

            if ($now->greaterThanOrEqualTo($deadline)) {
                $this->finalize($attempt, []);
                abort(Response::HTTP_CONFLICT, 'Time is up — this exam was submitted automatically.');
            }
        } else {
            abort_if($now->lessThan($exam->opens_at), Response::HTTP_FORBIDDEN, 'This exam is not open yet.');
            abort_if($now->greaterThan($exam->closes_at), Response::HTTP_FORBIDDEN, 'This exam is closed.');

            $attempt = ExamAttempt::create([
                'exam_id' => $exam->id,
                'student_id' => $student->id,
                'status' => ExamAttemptStatus::InProgress,
                'started_at' => $now,
            ]);

            $deadline = $this->deadline($exam, $attempt);
        }

        $remainingSeconds = max(0, $now->diffInSeconds($deadline, false));

        return response()->json([
            'attempt' => (array) StudentExamAttemptType::build($exam->load('questions.options'), $attempt->load('answers'), $remainingSeconds),
        ]);
    }

    public function submit(SubmitExamAttemptRequest $request, Exam $exam)
    {
        $student = $this->student($request);
        $this->authorizeEligible($exam, $student);

        $attempt = ExamAttempt::where('exam_id', $exam->id)->where('student_id', $student->id)->first();
        abort_if(! $attempt, Response::HTTP_NOT_FOUND);
        abort_if($attempt->status === ExamAttemptStatus::Submitted, Response::HTTP_CONFLICT, 'This exam has already been submitted.');

        $result = $this->finalize($attempt, $request->validated('records'));

        return response()->json(['result' => (array) $result]);
    }

    private function student(Request $request): Student
    {
        $student = Student::where('user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }

    private function authorizeEligible(Exam $exam, Student $student): void
    {
        $eligible = $exam->status === ExamStatus::Published
            && $exam->academic_year_id === $student->academic_year_id
            && $exam->grade_id === $student->grade_id
            && ($exam->classroom_id === null || $exam->classroom_id === $student->classroom_id);

        abort_unless($eligible, Response::HTTP_FORBIDDEN);
    }

    private function deadline(Exam $exam, ExamAttempt $attempt): Carbon
    {
        $byDuration = $attempt->started_at->copy()->addMinutes($exam->duration_minutes);

        return $byDuration->lessThan($exam->closes_at) ? $byDuration : Carbon::parse($exam->closes_at);
    }

    /**
     * Grades whatever records were given (possibly none, if the window
     * expired before the student answered anything) and locks the attempt
     * as submitted. Shared by submit() and show()'s expiry path so a
     * student who never explicitly submits still ends up with a real score
     * instead of an attempt stuck in_progress forever — which, since only
     * one attempt is ever allowed, would otherwise lock them out for good.
     */
    private function finalize(ExamAttempt $attempt, array $records): StudentExamResultType
    {
        $exam = $attempt->exam()->with('questions.options')->first();
        $optionsByQuestion = $exam->questions->keyBy('id');

        DB::transaction(function () use ($attempt, $records, $optionsByQuestion) {
            foreach ($records as $record) {
                $question = $optionsByQuestion->get($record['question_id']);
                if (! $question) {
                    continue;
                }

                $selectedOption = $question->options->firstWhere('id', $record['selected_option_id'] ?? null);
                $isCorrect = (bool) $selectedOption?->is_correct;

                ExamAttemptAnswer::updateOrCreate(
                    ['attempt_id' => $attempt->id, 'question_id' => $question->id],
                    [
                        'selected_option_id' => $record['selected_option_id'] ?? null,
                        'is_correct' => $isCorrect,
                        'marks_awarded' => $isCorrect ? $question->marks : 0,
                    ]
                );
            }

            $score = $attempt->answers()->sum('marks_awarded');

            $attempt->update([
                'status' => ExamAttemptStatus::Submitted,
                'submitted_at' => now(),
                'score' => $score,
            ]);
        });

        return StudentExamResultType::fromModel($attempt->fresh(['exam.questions']));
    }
}
