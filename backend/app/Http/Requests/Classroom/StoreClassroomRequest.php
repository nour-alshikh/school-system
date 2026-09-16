<?php

namespace App\Http\Requests\Classroom;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/**
 * Bulk create — the form lets an admin add several classrooms (same grade,
 * different names) in one submit, so this validates a `classrooms` array
 * rather than a single record. `subject_teachers`, when given, is the same
 * subject/teacher assignment applied to every classroom created in this
 * batch (they all share one grade already).
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
            'subject_teachers' => ['array'],
            'subject_teachers.*.subject_id' => ['required', 'integer', 'distinct', 'exists:subjects,id'],
            'subject_teachers.*.teacher_id' => ['required', 'integer', 'exists:teachers,id'],
        ];
    }

    /**
     * A teacher can only be assigned to a subject they are actually set up
     * to teach (Teacher::subjects) — see the matching guard on
     * UpdateClassroomSubjectTeachersRequest.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ($this->input('subject_teachers', []) as $index => $row) {
                if (! isset($row['subject_id'], $row['teacher_id'])) {
                    continue;
                }

                $teachesSubject = DB::table('subject_teacher')
                    ->where('subject_id', $row['subject_id'])
                    ->where('teacher_id', $row['teacher_id'])
                    ->exists();

                if (! $teachesSubject) {
                    $validator->errors()->add(
                        "subject_teachers.$index.teacher_id",
                        'The selected teacher does not teach this subject.'
                    );
                }
            }
        });
    }
}
