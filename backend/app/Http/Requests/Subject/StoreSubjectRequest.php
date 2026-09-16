<?php

namespace App\Http\Requests\Subject;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class StoreSubjectRequest extends FormRequest
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

    /**
     * A subject is scoped to stages or grades, never both — the frontend's
     * stage/grade toggle only ever fills one array, this is the backend's
     * guard against a client that skips it.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if (filled($this->input('stage_ids')) && filled($this->input('grade_ids'))) {
                $validator->errors()->add('grade_ids', 'A subject can be scoped to stages or grades, not both.');
            }
        });
    }
}
