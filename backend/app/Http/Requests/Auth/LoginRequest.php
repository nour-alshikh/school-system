<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            // Which per-role login form the request came from — checked
            // against the user's actual role in AuthService::login() so a
            // valid password on the wrong role's form still gets rejected.
            'role' => ['required', 'string', Rule::in(['admin', 'teacher', 'student', 'parent'])],
            // Only needed when the account has this role at more than one
            // school — see AuthService::login().
            'school_id' => ['nullable', 'integer'],
        ];
    }
}
