<?php

namespace App\Http\Requests\Classroom;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Bulk create — the form lets an admin add several classrooms (same grade,
 * different names) in one submit, so this validates a `classrooms` array
 * rather than a single record.
 */
class StoreClassroomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'classrooms' => ['required', 'array', 'min:1'],
            'classrooms.*.grade_id' => ['required', 'integer', 'exists:grades,id'],
            'classrooms.*.name' => ['required', 'string', 'max:255'],
            'classrooms.*.capacity' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
