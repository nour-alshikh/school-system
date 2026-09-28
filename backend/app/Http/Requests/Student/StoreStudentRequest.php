<?php

namespace App\Http\Requests\Student;

use App\Enums\Gender;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;

/**
 * Validates the whole registration wizard payload in one shot — the
 * frontend only submits once, at the final confirmation step.
 */
class StoreStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'student.name.en' => ['required', 'string', 'max:255'],
            'student.name.ar' => ['required', 'string', 'max:255'],
            'student.email' => ['required', 'string', 'email', 'max:255', 'unique:users,email', 'different:parent.email'],
            'student.password' => ['required', 'confirmed', Password::defaults()],
            'student.gender' => ['required', new Enum(Gender::class)],
            'student.nationality_id' => ['required', 'integer', 'exists:nationalities,id'],
            'student.governorate_id' => ['required', 'integer', 'exists:governorates,id'],
            'student.blood_type_id' => ['required', 'integer', 'exists:blood_types,id'],
            'student.stage_id' => ['required', 'integer', 'exists:stages,id'],
            'student.grade_id' => ['required', 'integer', Rule::exists('grades', 'id')->where('stage_id', $this->input('student.stage_id'))],
            'student.classroom_id' => ['required', 'integer', Rule::exists('classrooms', 'id')->where('grade_id', $this->input('student.grade_id'))],
            'student.academic_year_id' => ['required', 'integer', 'exists:academic_years,id'],

            // An existing account (a sibling's parent, here or at another
            // school) is linked instead of duplicated — StudentService::register()
            // — so the email needn't be new, and a password is only needed to
            // create a new account.
            'parent.email' => ['required', 'string', 'email', 'max:255'],
            'parent.password' => [
                Rule::requiredIf(fn () => ! User::where('email', $this->input('parent.email'))->exists()),
                'nullable', 'confirmed', Password::defaults(),
            ],

            'father.name' => ['required', 'string', 'max:255'],
            'father.job' => ['required', 'string', 'max:255'],
            'father.national_id' => ['required', 'string', 'max:255'],
            'father.phone' => ['required', 'string', 'max:255'],
            'father.nationality_id' => ['required', 'integer', 'exists:nationalities,id'],
            'father.governorate_id' => ['required', 'integer', 'exists:governorates,id'],
            'father.blood_type_id' => ['required', 'integer', 'exists:blood_types,id'],
            'father.religion_id' => ['required', 'integer', 'exists:religions,id'],
            'father.address' => ['required', 'string'],

            'mother.name' => ['required', 'string', 'max:255'],
            'mother.job' => ['required', 'string', 'max:255'],
            'mother.national_id' => ['required', 'string', 'max:255'],
            'mother.phone' => ['required', 'string', 'max:255'],
            'mother.nationality_id' => ['required', 'integer', 'exists:nationalities,id'],
            'mother.governorate_id' => ['required', 'integer', 'exists:governorates,id'],
            'mother.blood_type_id' => ['required', 'integer', 'exists:blood_types,id'],
            'mother.religion_id' => ['required', 'integer', 'exists:religions,id'],
            'mother.address' => ['required', 'string'],

            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['image', 'max:1024'],
        ];
    }
}
