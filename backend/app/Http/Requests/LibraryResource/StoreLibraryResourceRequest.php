<?php

namespace App\Http\Requests\LibraryResource;

use App\Enums\LibraryResourceKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/**
 * Authorization is deliberately not done here — grade scoping (admin: any
 * grade, teacher: only ones they hold a subject slot in) needs both the
 * request body and the current user, so LibraryResourceController does it
 * directly. Same convention as StoreMeetingRequest.
 */
class StoreLibraryResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'type' => ['required', new Enum(LibraryResourceKind::class)],
            'url' => ['required_if:type,link', 'nullable', 'string', 'url', 'max:2048'],
            'file' => ['required_if:type,file', 'nullable', 'file', 'max:1024'],
            'grade_id' => ['required', 'integer', 'exists:grades,id'],
            'subject_ids' => ['array'],
            'subject_ids.*' => ['integer', 'distinct', 'exists:subjects,id'],
        ];
    }
}
