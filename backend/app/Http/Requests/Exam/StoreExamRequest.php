<?php

namespace App\Http\Requests\Exam;

use App\Enums\ExamStatus;
use App\Enums\ExamType;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/**
 * Authorization is deliberately not done here — it's classroom/grade scoped
 * (admin: any grade or classroom, teacher: only classrooms they hold a
 * subject slot in), which needs both the request body and the current user,
 * so ExamController does it directly. Same convention as
 * StoreAttendanceRequest.
 */
class StoreExamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', new Enum(ExamType::class)],
            'subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'grade_id' => ['required', 'integer', 'exists:grades,id'],
            // Null/absent = the whole grade — see Exam::classroom().
            'classroom_id' => ['nullable', 'integer', 'exists:classrooms,id'],
            // academic_year_id is deliberately not a client field — see
            // ExamController::store(), which always resolves the current
            // AcademicYear itself. A teacher has no access to
            // /api/academic-years (gated on manage-academics|manage-students,
            // which the teacher role doesn't hold), same reasoning as why
            // attendance never asks for one either.
            'instructions' => ['nullable', 'string'],
            'duration_minutes' => ['required', 'integer', 'min:1'],
            'opens_at' => ['required', 'date'],
            'closes_at' => ['required', 'date', 'after:opens_at'],
            'status' => ['required', new Enum(ExamStatus::class)],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*.text' => ['required', 'string'],
            'questions.*.marks' => ['required', 'integer', 'min:1'],
            'questions.*.options' => ['required', 'array', 'min:2'],
            'questions.*.options.*.text' => ['required', 'string', 'max:255'],
            'questions.*.options.*.is_correct' => ['required', 'boolean'],
        ];
    }

    /**
     * MCQ invariant: every question needs exactly one correct option — not
     * expressible as a per-field rule, same technique as
     * StoreSubjectRequest's stage/grade exclusivity check.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ((array) $this->input('questions', []) as $index => $question) {
                $correctCount = collect($question['options'] ?? [])
                    ->filter(fn ($option) => (bool) ($option['is_correct'] ?? false))
                    ->count();

                if ($correctCount !== 1) {
                    $validator->errors()->add(
                        "questions.$index.options",
                        'Each question must have exactly one correct option.'
                    );
                }
            }
        });
    }
}
