<?php

namespace App\TypeScript;

use App\Enums\ExamAttemptStatus;
use App\Enums\ExamStatus;
use App\Enums\ExamType as ExamTypeEnum;
use App\Models\Exam;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * The teacher/admin list + detail shape — questions carry is_correct, so
 * this is never exposed to a student. See StudentExamListEntryType /
 * StudentExamAttemptType for the student-facing counterparts.
 *
 * Named ExamDetailType, not ExamType, because App\Enums\ExamType (exam vs.
 * quiz) already transforms to a TypeScript type named ExamType — two
 * exports with the same name in generated.ts would collide.
 */
#[TypeScript]
final class ExamDetailType
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly ExamTypeEnum $type,
        public readonly int $subject_id,
        public readonly int $grade_id,
        public readonly ?int $classroom_id,
        public readonly int $academic_year_id,
        public readonly SubjectType $subject,
        public readonly GradeType $grade,
        public readonly ?ClassroomType $classroom,
        public readonly AcademicYearType $academic_year,
        public readonly ?string $instructions,
        public readonly int $duration_minutes,
        public readonly string $opens_at,
        public readonly string $closes_at,
        public readonly ExamStatus $status,
        /** @var ExamQuestionType[] */
        public readonly array $questions,
        public readonly int $total_marks,
        public readonly int $attempts_count,
        public readonly int $submitted_count,
        public readonly string $created_at,
        public readonly string $updated_at,
    ) {}

    public static function fromModel(Exam $exam): self
    {
        return new self(
            id: $exam->id,
            title: $exam->title,
            type: $exam->type,
            subject_id: $exam->subject_id,
            grade_id: $exam->grade_id,
            classroom_id: $exam->classroom_id,
            academic_year_id: $exam->academic_year_id,
            subject: SubjectType::fromModel($exam->subject),
            grade: GradeType::fromModel($exam->grade),
            classroom: $exam->classroom ? ClassroomType::fromModel($exam->classroom) : null,
            academic_year: AcademicYearType::fromModel($exam->academicYear),
            instructions: $exam->instructions,
            duration_minutes: $exam->duration_minutes,
            opens_at: $exam->opens_at->toJSON(),
            closes_at: $exam->closes_at->toJSON(),
            status: $exam->status,
            questions: $exam->questions->map(ExamQuestionType::fromModel(...))->all(),
            total_marks: $exam->questions->sum('marks'),
            attempts_count: $exam->attempts->count(),
            submitted_count: $exam->attempts->where('status', ExamAttemptStatus::Submitted)->count(),
            created_at: $exam->created_at->toJSON(),
            updated_at: $exam->updated_at->toJSON(),
        );
    }
}
