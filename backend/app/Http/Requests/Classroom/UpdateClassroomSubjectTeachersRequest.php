<?php

namespace App\Http\Requests\Classroom;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

class UpdateClassroomSubjectTeachersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'assignments' => ['array'],
            'assignments.*.subject_id' => ['required', 'integer', 'distinct', 'exists:subjects,id'],
            'assignments.*.teacher_id' => ['required', 'integer', 'exists:teachers,id'],
        ];
    }

    /**
     * A teacher can only be assigned to a classroom subject they are
     * actually set up to teach (Teacher::subjects) — the frontend already
     * limits the picker to those teachers, this is the backend's guard
     * against a client that skips it.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ($this->input('assignments', []) as $index => $row) {
                if (! isset($row['subject_id'], $row['teacher_id'])) {
                    continue;
                }

                $teachesSubject = DB::table('subject_teacher')
                    ->where('subject_id', $row['subject_id'])
                    ->where('teacher_id', $row['teacher_id'])
                    ->exists();

                if (! $teachesSubject) {
                    $validator->errors()->add(
                        "assignments.$index.teacher_id",
                        'The selected teacher does not teach this subject.'
                    );
                }
            }
        });
    }
}
