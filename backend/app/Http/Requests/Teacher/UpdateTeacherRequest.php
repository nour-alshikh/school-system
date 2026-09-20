<?php

namespace App\Http\Requests\Teacher;

use App\Enums\TeacherStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;

class UpdateTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $teacher = $this->route('teacher');

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required', 'email', 'max:255',
                Rule::unique('teachers', 'email')->ignore($teacher),
                Rule::unique('users', 'email')->ignore($teacher?->user_id),
            ],
            'phone' => ['nullable', 'string', 'max:255'],
            'joining_date' => ['required', 'date'],
            'status' => ['required', new Enum(TeacherStatus::class)],
            // Leave blank to keep the existing login untouched (or to
            // leave the teacher without one). A non-empty value either
            // creates a login (if none exists yet) or changes the
            // existing one's password — see TeacherService::update.
            'password' => ['nullable', 'confirmed', Password::defaults()],
        ];
    }
}
