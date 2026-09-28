<?php

namespace App\Http\Requests\Classroom;

use App\Tenancy\TenantContext;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

/**
 * Bulk create — the form lets an admin add several classrooms (same grade,
 * different names) in one submit, so this validates a `classrooms` array
 * rather than a single record. Each classroom carries its own
 * `subject_teachers` — they share a grade, but not a teacher roster.
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
            'classrooms.*.subject_teachers' => ['array'],
            'classrooms.*.subject_teachers.*.subject_id' => ['required', 'integer', 'exists:subjects,id'],
            'classrooms.*.subject_teachers.*.teacher_id' => ['required', 'integer', 'exists:teachers,id'],
        ];
    }

    /**
     * Two checks per classroom's subject_teachers: no subject assigned twice
     * in the same classroom, and a teacher can only be assigned to a subject
     * they're actually set up to teach (Teacher::subjects) — see the
     * matching guard on UpdateClassroomSubjectTeachersRequest. Done here
     * (instead of a `distinct` rule) because `distinct` on a doubly-nested
     * wildcard like `classrooms.*.subject_teachers.*.subject_id` checks
     * uniqueness across every classroom, not within each one.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ($this->input('classrooms', []) as $classroomIndex => $classroom) {
                $seenSubjectIds = [];

                foreach ($classroom['subject_teachers'] ?? [] as $rowIndex => $row) {
                    if (! isset($row['subject_id'], $row['teacher_id'])) {
                        continue;
                    }

                    if (in_array($row['subject_id'], $seenSubjectIds, true)) {
                        $validator->errors()->add(
                            "classrooms.$classroomIndex.subject_teachers.$rowIndex.subject_id",
                            'Each subject can only be assigned once per classroom.'
                        );
                    }
                    $seenSubjectIds[] = $row['subject_id'];

                    $teachesSubject = DB::table('subject_teacher')
                        ->where('school_id', app(TenantContext::class)->id())
                        ->where('subject_id', $row['subject_id'])
                        ->where('teacher_id', $row['teacher_id'])
                        ->exists();

                    if (! $teachesSubject) {
                        $validator->errors()->add(
                            "classrooms.$classroomIndex.subject_teachers.$rowIndex.teacher_id",
                            'The selected teacher does not teach this subject.'
                        );
                    }

                    $isActive = DB::table('teachers')
                        ->where('school_id', app(TenantContext::class)->id())
                        ->where('id', $row['teacher_id'])
                        ->where('status', 'active')
                        ->exists();

                    if (! $isActive) {
                        $validator->errors()->add(
                            "classrooms.$classroomIndex.subject_teachers.$rowIndex.teacher_id",
                            'The selected teacher is not active.'
                        );
                    }
                }
            }
        });
    }
}
