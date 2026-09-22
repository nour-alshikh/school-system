<?php

namespace App\Http\Requests\LibraryResource;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLibraryResourceFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:1024'],
        ];
    }
}
