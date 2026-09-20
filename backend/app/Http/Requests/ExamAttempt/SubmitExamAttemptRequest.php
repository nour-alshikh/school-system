<?php

namespace App\Http\Requests\ExamAttempt;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Authorization (own attempt, still in progress, exam still reachable) is
 * done in StudentPortal\ExamController — needs the route's {exam} and the
 * logged-in student, same convention as StoreAttendanceRequest.
 */
class SubmitExamAttemptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'records' => ['required', 'array', 'min:1'],
            'records.*.question_id' => ['required', 'integer', 'exists:exam_questions,id'],
            'records.*.selected_option_id' => ['nullable', 'integer', 'exists:exam_question_options,id'],
        ];
    }
}
