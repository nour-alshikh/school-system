<?php

namespace App\Services;

use App\Http\Requests\Student\StoreStudentRequest;
use App\Http\Requests\Student\UpdateStudentRequest;
use App\Models\Classroom;
use App\Models\Father;
use App\Models\Mother;
use App\Models\Student;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class StudentService
{
    private const WITH = [
        'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom',
        'academicYear', 'nationality', 'governorate', 'bloodType', 'media',
    ];

    public function register(StoreStudentRequest $request): Student
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data) {
            $this->assertClassroomHasRoom((int) $data['student']['classroom_id']);

            $parentUser = User::create([
                'name' => $data['father']['name'],
                'email' => $data['parent']['email'],
                'password' => Hash::make($data['parent']['password']),
            ]);
            $parentUser->assignRole('parent');

            $studentUser = User::create([
                'name' => $data['student']['name']['en'],
                'email' => $data['student']['email'],
                'password' => Hash::make($data['student']['password']),
            ]);
            $studentUser->assignRole('student');

            $student = Student::create([
                'user_id' => $studentUser->id,
                'parent_user_id' => $parentUser->id,
                'name' => $data['student']['name'],
                'gender' => $data['student']['gender'],
                'nationality_id' => $data['student']['nationality_id'],
                'governorate_id' => $data['student']['governorate_id'],
                'blood_type_id' => $data['student']['blood_type_id'],
                'stage_id' => $data['student']['stage_id'],
                'grade_id' => $data['student']['grade_id'],
                'classroom_id' => $data['student']['classroom_id'],
                'academic_year_id' => $data['student']['academic_year_id'],
            ]);

            Father::create([...$data['father'], 'student_id' => $student->id]);
            Mother::create([...$data['mother'], 'student_id' => $student->id]);

            foreach ($data['attachments'] ?? [] as $attachment) {
                $student->addMedia($attachment)->toMediaCollection('attachments');
            }

            return $student->load(self::WITH);
        });
    }

    /**
     * Admin-only, full-access edit — unlike the parent portal's update
     * (guardian fields only), this can touch the student's own fields and
     * both accounts' email/password. Every field is optional (`sometimes`
     * in the request); only what's present in $data gets touched.
     */
    public function update(Student $student, UpdateStudentRequest $request): Student
    {
        $data = $request->validated();

        return DB::transaction(function () use ($student, $data) {
            $newClassroomId = $data['student']['classroom_id'] ?? null;
            if ($newClassroomId !== null && (int) $newClassroomId !== $student->classroom_id) {
                $this->assertClassroomHasRoom((int) $newClassroomId);
            }

            if (isset($data['student'])) {
                if (isset($data['student']['name'])) {
                    $student->setTranslations(
                        'name',
                        array_merge($student->getTranslations('name'), $data['student']['name'])
                    );
                }

                $student->fill(collect($data['student'])->except(['name', 'email', 'password', 'password_confirmation'])->toArray());
                $student->save();

                if (isset($data['student']['email'])) {
                    $student->user->email = $data['student']['email'];
                }
                if (isset($data['student']['name']['en'])) {
                    $student->user->name = $data['student']['name']['en'];
                }
                if (! empty($data['student']['password'])) {
                    $student->user->password = Hash::make($data['student']['password']);
                }
                $student->user->save();
            }

            if (isset($data['parent'])) {
                if (isset($data['parent']['email'])) {
                    $student->parentUser->email = $data['parent']['email'];
                }
                if (! empty($data['parent']['password'])) {
                    $student->parentUser->password = Hash::make($data['parent']['password']);
                }
                $student->parentUser->save();
            }

            if (isset($data['father'])) {
                $student->father()->update($data['father']);
            }

            if (isset($data['mother'])) {
                $student->mother()->update($data['mother']);
            }

            return $student->fresh(self::WITH);
        });
    }

    /**
     * Deletes the whole registration, not just the Student row: the
     * student's own account and the parent's are each meaningless without
     * it, so both go too. `students.user_id` and `students.parent_user_id`
     * are `cascadeOnDelete`, so deleting either user cascades away the
     * Student row (and father/mother/media cascade from there) — deleting
     * both explicitly here is what actually removes every trace.
     */
    public function delete(Student $student): void
    {
        DB::transaction(function () use ($student) {
            $parentUser = $student->parentUser;
            $studentUser = $student->user;

            $studentUser->delete();
            $parentUser?->delete();
        });
    }

    /**
     * Checked inside the same transaction as the insert so two concurrent
     * registrations can't both slip into the last open seat — the second
     * transaction's read is blocked until the first commits, by which point
     * its own count reflects the new row.
     */
    private function assertClassroomHasRoom(int $classroomId): void
    {
        $classroom = Classroom::lockForUpdate()->withCount('students')->findOrFail($classroomId);

        if ($classroom->capacity !== null && $classroom->students_count >= $classroom->capacity) {
            throw ValidationException::withMessages([
                'student.classroom_id' => __('This classroom is full.'),
            ]);
        }
    }
}
