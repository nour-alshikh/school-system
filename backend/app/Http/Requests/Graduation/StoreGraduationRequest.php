<?php

namespace App\Http\Requests\Graduation;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A graduation has no destination — just the source classroom (same
 * classroom-only scoping as StorePromotionRequest's `from`) and who to
 * leave out of the batch.
 */
class StoreGraduationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'classroom_id' => ['required', 'integer', 'exists:classrooms,id'],

            'except_student_ids' => ['array'],
            'except_student_ids.*' => ['integer', 'exists:students,id'],
        ];
    }
}
