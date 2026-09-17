<?php

namespace App\Http\Requests\Promotion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `from.classroom_id` only scopes which students are eligible (see
 * PromotionService::resolveSourceStudents), so it isn't written to any
 * record and doesn't need the parent/child consistency `to` does — a
 * promotion always moves one whole classroom at a time, never a bare grade
 * or stage. `to` becomes every promoted student's new stage/grade/
 * classroom/academic_year, so it's validated the same way
 * StoreStudentRequest validates a fresh assignment.
 */
class StorePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from.classroom_id' => ['required', 'integer', 'exists:classrooms,id'],

            'to.stage_id' => ['required', 'integer', 'exists:stages,id'],
            'to.grade_id' => ['required', 'integer', Rule::exists('grades', 'id')->where('stage_id', $this->input('to.stage_id'))],
            'to.classroom_id' => ['required', 'integer', Rule::exists('classrooms', 'id')->where('grade_id', $this->input('to.grade_id'))],
            'to.academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],

            'except_student_ids' => ['array'],
            'except_student_ids.*' => ['integer', 'exists:students,id'],
        ];
    }
}
