<?php

namespace App\Services;

use App\Http\Requests\Teacher\StoreTeacherRequest;
use App\Http\Requests\Teacher\UpdateTeacherRequest;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class TeacherService
{
    public function create(StoreTeacherRequest $request): Teacher
    {
        $data = $request->validated();
        $password = $data['password'] ?? null;
        unset($data['password'], $data['password_confirmation']);

        return DB::transaction(function () use ($data, $password) {
            $teacher = Teacher::create($data);

            if ($password) {
                $this->createLogin($teacher, $password);
            }

            return $teacher->load('subjects');
        });
    }

    public function update(Teacher $teacher, UpdateTeacherRequest $request): Teacher
    {
        $data = $request->validated();
        $password = $data['password'] ?? null;
        unset($data['password'], $data['password_confirmation']);

        return DB::transaction(function () use ($teacher, $data, $password) {
            $teacher->update($data);

            if ($password) {
                if ($teacher->user_id) {
                    $teacher->user->update(['email' => $teacher->email, 'password' => Hash::make($password)]);
                } else {
                    $this->createLogin($teacher, $password);
                }
            } elseif ($teacher->user_id) {
                // No new password, but the login's email still has to track
                // the teacher's own email — they're the same identity.
                $teacher->user->update(['email' => $teacher->email]);
            }

            return $teacher->fresh('subjects');
        });
    }

    /**
     * Deletes the linked login too, not just the Teacher row — a dangling
     * `teacher` role account with no Teacher record behind it could still
     * log in and hit AttendanceController with nothing to scope it to.
     * `teachers.user_id` is `cascadeOnDelete`, so deleting the user cascades
     * away the Teacher row on its own.
     */
    public function delete(Teacher $teacher): void
    {
        DB::transaction(function () use ($teacher) {
            $user = $teacher->user;

            if ($user) {
                $user->delete();
            } else {
                $teacher->delete();
            }
        });
    }

    private function createLogin(Teacher $teacher, string $password): void
    {
        $user = User::create([
            'name' => $teacher->name,
            'email' => $teacher->email,
            'password' => Hash::make($password),
        ]);
        $user->assignRole('teacher');

        $teacher->update(['user_id' => $user->id]);
    }
}
