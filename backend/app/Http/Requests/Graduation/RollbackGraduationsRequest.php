<?php

namespace App\Http\Requests\Graduation;

use Illuminate\Foundation\Http\FormRequest;

class RollbackGraduationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'graduation_ids' => ['required', 'array', 'min:1'],
            'graduation_ids.*' => ['integer', 'exists:graduations,id'],
        ];
    }
}
