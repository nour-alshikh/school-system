<?php

namespace Database\Seeders\Demo;

use App\Enums\StudentStatus;
use App\Models\AcademicYear;
use App\Models\ClassroomSubjectTeacher;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\ExamAttemptAnswer;
use App\Models\ExamQuestion;
use App\Models\Grade;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Three exams per school, one per state a teacher and student can see: a
 * closed quiz with scored attempts, an exam open right now with some
 * attempts in progress, and a draft for next week. Plus four earlier weekly
 * quizzes per grade, scored a little better each week, so the dashboards'
 * score trends have a shape.
 */
class ExamDemoSeeder
{
    private const SCIENCE = [
        ['What do plants need to make their food?', ['Sunlight', 'Sand', 'Plastic', 'Salt'], 0],
        ['Which is a mammal?', ['Shark', 'Dolphin', 'Frog', 'Eagle'], 1],
        ['Water boils at…', ['50 °C', '75 °C', '100 °C', '150 °C'], 2],
        ['Which planet do we live on?', ['Mars', 'Venus', 'Jupiter', 'Earth'], 3],
        ['What gas do we breathe in to live?', ['Oxygen', 'Helium', 'Carbon dioxide', 'Nitrogen'], 0],
    ];

    private const GENERAL = [
        ['How many days are in a week?', ['Five', 'Six', 'Seven', 'Eight'], 2],
        ['Which of these is a continent?', ['Africa', 'Nile', 'Cairo', 'Sahara'], 0],
        ['How many months are in a year?', ['Ten', 'Twelve', 'Fourteen', 'Nine'], 1],
        ['What comes after Tuesday?', ['Monday', 'Thursday', 'Wednesday', 'Sunday'], 2],
        ['Which is the largest ocean?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3],
    ];

    public function run(User $admin): void
    {
        $year = AcademicYear::where('is_current', true)->firstOrFail();

        // Grades that have students, so the exams have someone to take them.
        $grades = Grade::whereIn('id', Student::where('status', StudentStatus::Active)->distinct()->pluck('grade_id'))
            ->with('stage.subjects')
            ->orderBy('id')
            ->get();

        $plans = [
            ['title' => 'Math quiz', 'type' => 'quiz', 'subject' => 'Mathematics', 'status' => 'published',
                'opens' => now()->subDays(10), 'closes' => now()->subDays(7), 'attempts' => 'scored'],
            ['title' => 'Science exam', 'type' => 'exam', 'subject' => 'Science', 'status' => 'published',
                'opens' => now()->subDays(2), 'closes' => now()->addDays(3), 'attempts' => 'mixed'],
            ['title' => 'End of unit exam', 'type' => 'exam', 'subject' => 'Arabic', 'status' => 'draft',
                'opens' => now()->addWeek(), 'closes' => now()->addWeek()->addDays(2), 'attempts' => 'none'],
        ];

        foreach ($plans as $i => $plan) {
            $grade = $grades[$i % $grades->count()];
            $subject = $this->subjectFor($grade, $plan['subject']);

            $exam = Exam::create([
                'title' => $plan['title'].' — '.$grade->getTranslation('name', 'en'),
                'type' => $plan['type'],
                'subject_id' => $subject->id,
                'grade_id' => $grade->id,
                'classroom_id' => null,
                'academic_year_id' => $year->id,
                'created_by' => $this->teacherUserId($grade, $subject) ?? $admin->id,
                'instructions' => 'Choose one answer for each question. You can change answers until you submit.',
                'duration_minutes' => $plan['type'] === 'quiz' ? 20 : 45,
                'opens_at' => $plan['opens']->copy()->setTime(8, 0),
                'closes_at' => $plan['closes']->copy()->setTime(20, 0),
                'status' => $plan['status'],
            ]);

            $questions = $this->questions($exam, $subject);
            $students = Student::where('grade_id', $grade->id)->where('status', StudentStatus::Active)->orderBy('id')->get();

            match ($plan['attempts']) {
                'scored' => $students->filter(fn () => fake()->boolean(85))->each(fn (Student $s) => $this->attempt($exam, $s, $questions, submitted: true)),
                'mixed' => $students->take(6)->each(fn (Student $s, int $n) => $this->attempt($exam, $s, $questions, submitted: $n % 2 === 0)),
                default => null,
            };
        }

        foreach ($grades as $grade) {
            foreach ([6, 5, 4, 3] as $n => $weeksAgo) {
                $subject = $this->subjectFor($grade, $n % 2 === 0 ? 'Mathematics' : 'Science');
                $closes = now()->subWeeks($weeksAgo);

                $exam = Exam::create([
                    'title' => 'Weekly quiz '.($n + 1).' — '.$grade->getTranslation('name', 'en'),
                    'type' => 'quiz',
                    'subject_id' => $subject->id,
                    'grade_id' => $grade->id,
                    'classroom_id' => null,
                    'academic_year_id' => $year->id,
                    'created_by' => $this->teacherUserId($grade, $subject) ?? $admin->id,
                    'instructions' => 'Choose one answer for each question.',
                    'duration_minutes' => 15,
                    'opens_at' => $closes->copy()->subDays(2)->setTime(8, 0),
                    'closes_at' => $closes->copy()->setTime(20, 0),
                    'status' => 'published',
                ]);

                $questions = $this->questions($exam, $subject);
                Student::where('grade_id', $grade->id)->where('status', StudentStatus::Active)->orderBy('id')->get()
                    ->filter(fn () => fake()->boolean(90))
                    ->each(fn (Student $s) => $this->attempt($exam, $s, $questions, submitted: true, accuracy: 58 + $n * 8));
            }
        }
    }

    /** $preferred if this grade's stage has it, else any subject of the stage. */
    private function subjectFor(Grade $grade, string $preferred): Subject
    {
        $subjects = $grade->stage->subjects;

        return $subjects->first(fn (Subject $s) => $s->getTranslation('name', 'en') === $preferred) ?? $subjects->first();
    }

    /** The teacher assigned this subject in one of the grade's classrooms. */
    private function teacherUserId(Grade $grade, Subject $subject): ?int
    {
        return ClassroomSubjectTeacher::with('teacher')
            ->where('subject_id', $subject->id)
            ->whereIn('classroom_id', $grade->classrooms()->pluck('id'))
            ->orderBy('classroom_id')
            ->first()?->teacher?->user_id;
    }

    /**
     * Five multiple-choice questions: generated sums for maths, a small
     * science bank, general questions otherwise.
     *
     * @return Collection<int, array{question: ExamQuestion, correct_id: int, option_ids: list<int>}>
     */
    private function questions(Exam $exam, Subject $subject): Collection
    {
        $bank = match ($subject->getTranslation('name', 'en')) {
            'Mathematics' => $this->mathBank(),
            'Science' => self::SCIENCE,
            default => self::GENERAL,
        };

        return collect($bank)->map(function (array $row, int $order) use ($exam) {
            [$text, $options, $correct] = $row;
            $question = $exam->questions()->create(['text' => $text, 'marks' => $order < 3 ? 1 : 2, 'order' => $order + 1]);

            $ids = collect($options)->map(fn (string $option, int $i) => $question->options()->create([
                'text' => $option, 'is_correct' => $i === $correct, 'order' => $i + 1,
            ])->id)->all();

            return ['question' => $question, 'correct_id' => $ids[$correct], 'option_ids' => $ids];
        });
    }

    private function mathBank(): array
    {
        return collect(range(1, 5))->map(function () {
            [$a, $b] = [fake()->numberBetween(3, 12), fake()->numberBetween(3, 12)];
            $answer = $a * $b;
            $options = collect([$answer, $answer + $a, $answer - $b, $answer + 1])->shuffle(fake()->randomNumber())->values();

            return ["What is {$a} × {$b}?", $options->map(fn ($n) => (string) $n)->all(), $options->search($answer)];
        })->all();
    }

    /** Answers each question (right $accuracy% of the time); scored if submitted. */
    private function attempt(Exam $exam, Student $student, Collection $questions, bool $submitted, int $accuracy = 75): bool
    {
        $started = $exam->opens_at->copy()->addHours(fake()->numberBetween(1, 30));
        if ($started->isFuture()) {
            $started = now()->subMinutes(fake()->numberBetween(5, 30));
        }

        $attempt = ExamAttempt::create([
            'exam_id' => $exam->id,
            'student_id' => $student->id,
            'status' => $submitted ? 'submitted' : 'in_progress',
            'started_at' => $started,
            'submitted_at' => $submitted ? $started->copy()->addMinutes(fake()->numberBetween(8, $exam->duration_minutes)) : null,
        ]);

        $score = 0;
        foreach ($questions as $q) {
            $right = fake()->boolean($accuracy);
            $marks = $right ? $q['question']->marks : 0;
            $score += $marks;

            ExamAttemptAnswer::create([
                'attempt_id' => $attempt->id,
                'question_id' => $q['question']->id,
                'selected_option_id' => $right ? $q['correct_id'] : fake()->randomElement(array_values(array_diff($q['option_ids'], [$q['correct_id']]))),
                'is_correct' => $right,
                'marks_awarded' => $marks,
            ]);
        }

        if ($submitted) {
            $attempt->update(['score' => $score]);
        }

        return true;
    }
}
