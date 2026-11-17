<?php

namespace App\Http\Requests\SchoolSignup;

use App\Rules\SchoolSlug;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A signed-in user adding a school to their account.
 */
class CreateSchoolRequest extends FormRequest
{
    use ValidatesBlueprint;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'school_name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', new SchoolSlug],
            ...$this->blueprintRules(),
        ];
    }
}
