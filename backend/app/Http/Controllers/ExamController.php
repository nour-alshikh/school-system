<?php

namespace App\Http\Controllers;

use App\Enums\StudentStatus;
use App\Http\Requests\Exam\StoreExamRequest;
use App\Http\Requests\Exam\UpdateExamRequest;
use App\Http\Resources\ExamResource;
use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\Exam;
use App\Models\ExamAttempt;
use App\Models\Student;
use App\TypeScript\ExamResultEntryType;
use App\TypeScript\ExamTeachingAssignmentType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class ExamController extends Controller
{
    private const WITH = ['subject', 'grade', 'classroom', 'academicYear', 'questions.options', 'attempts'];

    /**
     * Admin (manage-exams) sees every exam; a teacher only sees the ones
     * they created — same "own scope" idea as AttendanceController's
     * classrooms(), just filtered by creator instead of classroom
     * assignment since exams aren't shared across teachers.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Exam::with(self::WITH)->orderByDesc('id');

        if (! $user->can('manage-exams')) {
            $query->where('created_by', $user->id);
        }

        return response()->json(['exams' => ExamResource::collection($query->get())]);
    }

    public function store(StoreExamRequest $request)
    {
        $data = $request->validated();
        $this->authorizeTarget($request, $data['classroom_id'] ?? null, $data['subject_id']);
        $this->assertClassroomInGrade($data['grade_id'], $data['classroom_id'] ?? null);

        $exam = DB::transaction(function () use ($data, $request) {
            $exam = Exam::create([
                ...collect($data)->except('questions')->toArray(),
                'academic_year_id' => $this->currentAcademicYearId(),
                'created_by' => $request->user()->id,
            ]);

            $this->syncQuestions($exam, $data['questions']);

            return $exam;
        });

        return response()->json(['exam' => new ExamResource($exam->load(self::WITH))], 201);
    }

    public function show(Request $request, Exam $exam)
    {
        $this->authorizeManage($request, $exam);

        return response()->json(['exam' => new ExamResource($exam->load(self::WITH))]);
    }

    /**
     * Blocked entirely once any attempt exists — editing questions/options
     * out from under a student who already has a score would corrupt it.
     * Same protective spirit as TeacherController blocking status changes
     * while classroomSubjects exist.
     */
    public function update(UpdateExamRequest $request, Exam $exam)
    {
        $this->authorizeManage($request, $exam);
        abort_if($exam->attempts()->exists(), Response::HTTP_UNPROCESSABLE_ENTITY, 'This exam already has attempts and can no longer be edited.');

        $data = $request->validated();
        $this->authorizeTarget($request, $data['classroom_id'] ?? null, $data['subject_id']);
        $this->assertClassroomInGrade($data['grade_id'], $data['classroom_id'] ?? null);

        DB::transaction(function () use ($exam, $data) {
            $exam->update(collect($data)->except('questions')->toArray());
            $exam->questions()->delete();
            $this->syncQuestions($exam, $data['questions']);
        });

        return response()->json(['exam' => new ExamResource($exam->fresh(self::WITH))]);
    }

    public function destroy(Request $request, Exam $exam)
    {
        $this->authorizeManage($request, $exam);
        abort_if($exam->attempts()->exists(), Response::HTTP_UNPROCESSABLE_ENTITY, 'This exam already has attempts and cannot be deleted.');

        $exam->delete();

        return response()->noContent();
    }

    /**
     * The results roster: every student eligible for this exam, paired with
     * their attempt if they've started/finished one — same "eligible record
     * + maybe a row" shape as AttendanceController::index().
     */
    public function results(Request $request, Exam $exam)
    {
        $this->authorizeManage($request, $exam);

        $students = $this->eligibleStudents($exam)->get();

        $attemptsByStudent = ExamAttempt::where('exam_id', $exam->id)
            ->whereIn('student_id', $students->pluck('id'))
            ->get()
            ->keyBy('student_id');

        $rows = $students
            ->map(fn (Student $student) => ExamResultEntryType::build($student, $attemptsByStudent->get($student->id)))
            ->values()
            ->all();

        return response()->json(['results' => $rows]);
    }

    /**
     * The classroom+subject combinations the current teacher actually
     * teaches — what populates the classroom/subject picker on the exam
     * form for a teacher, since they can't reach /api/grades or
     * /api/classrooms (gated on manage-academics|manage-students, which the
     * teacher role doesn't hold). An admin doesn't call this; they use the
     * full pickers via those endpoints instead.
     */
    public function teachingAssignments(Request $request)
    {
        $teacher = $request->user()->teacher;

        if (! $teacher) {
            return response()->json(['assignments' => []]);
        }

        $assignments = $teacher->classroomSubjects()
            ->with(['classroom.grade', 'subject'])
            ->get()
            ->map(fn ($assignment) => ExamTeachingAssignmentType::fromModel($assignment))
            ->values()
            ->all();

        return response()->json(['assignments' => $assignments]);
    }

    private function currentAcademicYearId(): int
    {
        return AcademicYear::where('is_current', true)->firstOrFail()->id;
    }

    /**
     * Creating a grade-wide exam (no classroom_id) needs manage-exams — a
     * teacher can't be trusted to blanket-target every classroom in a
     * grade, including ones they don't teach. A classroom-scoped exam is
     * fine for a teacher too, but only for a classroom+subject combination
     * they actually hold via ClassroomSubjectTeacher. Same idea as
     * AttendanceController::authorizeClassroom().
     */
    private function authorizeTarget(Request $request, ?int $classroomId, int $subjectId): void
    {
        $user = $request->user();

        if ($user->can('manage-exams')) {
            return;
        }

        abort_if($classroomId === null, Response::HTTP_FORBIDDEN, 'Only an admin can create a grade-wide exam.');

        $teacher = $user->teacher;
        abort_if(
            ! $teacher || ! $teacher->classroomSubjects()
                ->where('classroom_id', $classroomId)
                ->where('subject_id', $subjectId)
                ->exists(),
            Response::HTTP_FORBIDDEN
        );
    }

    private function assertClassroomInGrade(int $gradeId, ?int $classroomId): void
    {
        if ($classroomId === null) {
            return;
        }

        $classroom = Classroom::findOrFail($classroomId);
        abort_if($classroom->grade_id !== $gradeId, Response::HTTP_UNPROCESSABLE_ENTITY, 'That classroom does not belong to the selected grade.');
    }

    private function authorizeManage(Request $request, Exam $exam): void
    {
        $user = $request->user();

        if ($user->can('manage-exams')) {
            return;
        }

        abort_if($exam->created_by !== $user->id, Response::HTTP_FORBIDDEN);
    }

    private function syncQuestions(Exam $exam, array $questions): void
    {
        foreach ($questions as $questionIndex => $question) {
            $created = $exam->questions()->create([
                'text' => $question['text'],
                'marks' => $question['marks'],
                'order' => $questionIndex,
            ]);

            foreach ($question['options'] as $optionIndex => $option) {
                $created->options()->create([
                    'text' => $option['text'],
                    'is_correct' => $option['is_correct'],
                    'order' => $optionIndex,
                ]);
            }
        }
    }

    private function eligibleStudents(Exam $exam)
    {
        $query = Student::where('academic_year_id', $exam->academic_year_id)
            ->where('grade_id', $exam->grade_id)
            ->where('status', StudentStatus::Active)
            ->orderBy('id');

        if ($exam->classroom_id !== null) {
            $query->where('classroom_id', $exam->classroom_id);
        }

        return $query;
    }
}
