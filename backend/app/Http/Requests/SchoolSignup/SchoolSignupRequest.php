<?php

namespace App\Http\Requests\SchoolSignup;

use App\Rules\SchoolSlug;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Log;
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

    /**
     * A hidden field people never see or fill; bots that fill every input
     * do. Checked before validation, so a bot learns nothing from field
     * errors (e.g. that an email is registered). Nothing is created, and
     * the message doesn't say why.
     */
    protected function prepareForValidation(): void
    {
        if ($this->filled('website')) {
            Log::warning('School signup rejected by honeypot', ['ip' => $this->ip()]);
            abort(422, __('api.signup_rejected'));
        }
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
