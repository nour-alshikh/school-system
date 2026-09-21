<?php

namespace App\Http\Requests\Meeting;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Authorization is deliberately not done here — classroom scoping (admin:
 * any classroom, teacher: only ones they hold a subject slot in) needs both
 * the request body and the current user, so MeetingController does it
 * directly. Same convention as StoreAttendanceRequest/StoreExamRequest.
 */
class StoreMeetingRequest extends FormRequest
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
            'classroom_ids' => ['required', 'array', 'min:1'],
            'classroom_ids.*' => ['integer', 'exists:classrooms,id'],
            'start_time' => ['required', 'date', 'after:now'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:480'],
        ];
    }
}
