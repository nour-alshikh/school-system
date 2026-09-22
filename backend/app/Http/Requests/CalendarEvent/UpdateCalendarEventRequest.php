<?php

namespace App\Http\Requests\CalendarEvent;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCalendarEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'date' => ['sometimes', 'required', 'date'],
        ];
    }
}
