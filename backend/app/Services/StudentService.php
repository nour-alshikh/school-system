<?php

namespace App\Services;

use App\Http\Requests\Student\StoreStudentRequest;
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

            return $student->load(['user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom', 'academicYear', 'nationality', 'governorate', 'bloodType']);
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
