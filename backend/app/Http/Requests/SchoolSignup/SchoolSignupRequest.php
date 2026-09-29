<?php

namespace App\Http\Requests\SchoolSignup;

use App\Rules\SchoolSlug;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/**
 * A guest creating an account and a school in one go. The account fields
 * match RegisterRequest.
 */
class SchoolSignupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'school_name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', new SchoolSlug],
        ];
    }
}
