<?php

namespace App\Http\Requests\LibraryResource;

use App\Enums\LibraryResourceKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/**
 * Metadata only — no file field. Replacing the uploaded file is its own
 * endpoint (UpdateLibraryResourceFileRequest), same split as
 * StudentController::storeAttachments() being separate from the student's
 * own update — there's no meaningful reason to force a PUT of everything
 * else through multipart just because the file might change too.
 */
class UpdateLibraryResourceRequest extends FormRequest
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
            'grade_id' => ['required', 'integer', 'exists:grades,id'],
            'subject_ids' => ['array'],
            'subject_ids.*' => ['integer', 'distinct', 'exists:subjects,id'],
        ];
    }
}
