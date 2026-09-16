<?php

namespace App\Http\Requests\ParentPortal;

use Illuminate\Foundation\Http\FormRequest;

/**
 * A parent may correct their own contact details on the student's record —
 * the father/mother rows — but not the student's own fields (name, academic
 * assignment, ...); those stay admin-only. Fields are `sometimes` so either
 * guardian, or any subset of its fields, can be sent without the other.
 */
class UpdateStudentGuardiansRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            ...$this->guardianRules('father'),
            ...$this->guardianRules('mother'),
        ];
    }

    private function guardianRules(string $prefix): array
    {
        return [
            $prefix => ['sometimes', 'array'],
            "$prefix.name" => ['sometimes', 'string', 'max:255'],
            "$prefix.job" => ['sometimes', 'string', 'max:255'],
            "$prefix.national_id" => ['sometimes', 'string', 'max:255'],
            "$prefix.phone" => ['sometimes', 'string', 'max:255'],
            "$prefix.nationality_id" => ['sometimes', 'integer', 'exists:nationalities,id'],
            "$prefix.governorate_id" => ['sometimes', 'integer', 'exists:governorates,id'],
            "$prefix.blood_type_id" => ['sometimes', 'integer', 'exists:blood_types,id'],
            "$prefix.religion_id" => ['sometimes', 'integer', 'exists:religions,id'],
            "$prefix.address" => ['sometimes', 'string'],
        ];
    }
}
