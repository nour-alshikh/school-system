<?php

namespace App\Http\Requests\Teacher;

use App\Enums\TeacherStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;

class StoreTeacherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            // Unique against both tables: this email doubles as the login
            // once a password is set (see TeacherService::createLogin), so
            // it can never collide with an existing user's either.
            'email' => [
                'required', 'email', 'max:255',
                Rule::unique('teachers', 'email'),
                Rule::unique('users', 'email'),
            ],
            'phone' => ['nullable', 'string', 'max:255'],
            'joining_date' => ['required', 'date'],
            'status' => ['required', new Enum(TeacherStatus::class)],
            // Optional — a teacher can exist purely as a record with no
            // login. Set it to grant attendance-marking access.
            'password' => ['nullable', 'confirmed', Password::defaults()],
        ];
    }
}
