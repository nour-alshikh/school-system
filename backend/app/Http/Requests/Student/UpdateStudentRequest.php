<?php

namespace App\Http\Requests\Student;

use App\Enums\Gender;
use App\Models\Student;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;

/**
 * Every field is `sometimes` — an admin edit only sends what changed —
 * except the two password fields, which are `nullable` so they can be
 * cleared (i.e. "don't change it") without failing `confirmed`.
 */
class UpdateStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        /** @var Student $student */
        $student = $this->route('student');

        return [
            'student.name.en' => ['sometimes', 'string', 'max:255'],
            'student.name.ar' => ['sometimes', 'string', 'max:255'],
            'student.email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($student->user_id), 'different:parent.email'],
            'student.password' => ['nullable', 'confirmed', Password::defaults()],
            'student.gender' => ['sometimes', new Enum(Gender::class)],
            'student.nationality_id' => ['sometimes', 'integer', 'exists:nationalities,id'],
            'student.governorate_id' => ['sometimes', 'integer', 'exists:governorates,id'],
            'student.blood_type_id' => ['sometimes', 'integer', 'exists:blood_types,id'],
            'student.stage_id' => ['sometimes', 'integer', 'exists:stages,id'],
            'student.grade_id' => ['sometimes', 'integer', Rule::exists('grades', 'id')->where('stage_id', $this->input('student.stage_id', $student->stage_id))],
            'student.classroom_id' => ['sometimes', 'integer', Rule::exists('classrooms', 'id')->where('grade_id', $this->input('student.grade_id', $student->grade_id))],
            'student.academic_year_id' => ['sometimes', 'integer', 'exists:academic_years,id'],

            'parent.email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($student->parent_user_id), 'different:student.email'],
            'parent.password' => ['nullable', 'confirmed', Password::defaults()],

            ...$this->guardianRules('father'),
            ...$this->guardianRules('mother'),
        ];
    }

    private function guardianRules(string $prefix): array
    {
        return [
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
