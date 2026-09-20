<?php

namespace App\Http\Requests\Exam;

use App\Enums\ExamStatus;
use App\Enums\ExamType;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateExamRequest extends FormRequest
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
            // academic_year_id is not editable — see StoreExamRequest.
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
