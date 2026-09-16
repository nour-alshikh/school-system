<?php

namespace App\Http\Requests\Subject;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class UpdateSubjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name.en' => ['required', 'string', 'max:255'],
            'name.ar' => ['required', 'string', 'max:255'],
            'stage_ids' => ['required_without:grade_ids', 'array'],
            'stage_ids.*' => ['integer', 'distinct', 'exists:stages,id'],
            'grade_ids' => ['required_without:stage_ids', 'array'],
            'grade_ids.*' => ['integer', 'distinct', 'exists:grades,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (filled($this->input('stage_ids')) && filled($this->input('grade_ids'))) {
                $validator->errors()->add('grade_ids', 'A subject can be scoped to stages or grades, not both.');
            }
        });
    }
}
