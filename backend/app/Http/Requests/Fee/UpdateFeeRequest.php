<?php

namespace App\Http\Requests\Fee;

use App\Models\Grade;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

class UpdateFeeRequest extends FormRequest
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
            'academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'is_active' => ['required', 'boolean'],
            'is_for_all' => ['required', 'boolean'],
            'stage_id' => ['required_if:is_for_all,false', 'prohibited_if:is_for_all,true', 'integer', 'exists:stages,id'],
            'grade_id' => ['required_if:is_for_all,false', 'prohibited_if:is_for_all,true', 'integer', 'exists:grades,id'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->boolean('is_for_all') || ! $this->filled('grade_id')) {
                return;
            }

            $grade = Grade::find($this->input('grade_id'));

            if ($grade && (string) $grade->stage_id !== (string) $this->input('stage_id')) {
                $validator->errors()->add('grade_id', 'The selected grade does not belong to the selected stage.');
            }
        });
    }
}
