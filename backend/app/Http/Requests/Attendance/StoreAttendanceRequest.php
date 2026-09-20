<?php

namespace App\Http\Requests\Attendance;

use App\Enums\AttendanceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

/**
 * Authorization is deliberately not done here (see authorize() below) —
 * it's classroom-scoped (admin: any classroom, teacher: only ones they
 * teach in), which needs the route's {classroom} model, so
 * AttendanceController does it directly. Same convention as
 * ParentPortal\StudentController.
 */
class StoreAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => ['required', 'date'],
            'records' => ['required', 'array', 'min:1'],
            'records.*.student_id' => ['required', 'integer', 'exists:students,id'],
            'records.*.status' => ['required', new Enum(AttendanceStatus::class)],
            'records.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
