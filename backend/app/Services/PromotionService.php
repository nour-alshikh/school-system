<?php

namespace App\Services;

use App\Http\Requests\Promotion\StorePromotionRequest;
use App\Models\Classroom;
use App\Models\Promotion;
use App\Models\Student;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PromotionService
{
    /**
     * Resolves the source set, moves every one of them to `to`, and logs
     * one Promotion row per student — all inside one transaction, so a
     * capacity failure partway through never leaves some students promoted
     * and others not.
     */
    public function promote(StorePromotionRequest $request, Authenticatable $promotedBy): Collection
    {
        $data = $request->validated();
        $exceptIds = $data['except_student_ids'] ?? [];

        return DB::transaction(function () use ($data, $exceptIds, $promotedBy) {
            $students = $this->resolveSourceStudents($data['from'], $exceptIds);

            if ($students->isEmpty()) {
                throw ValidationException::withMessages([
                    'from' => __('No students match the selected source.'),
                ]);
            }

            $this->assertClassroomHasRoom(
                (int) $data['to']['classroom_id'],
                $students->pluck('id')->all(),
            );

            return $students->map(function (Student $student) use ($data, $promotedBy) {
                $promotion = Promotion::create([
                    'student_id' => $student->id,
                    'from_stage_id' => $student->stage_id,
                    'from_grade_id' => $student->grade_id,
                    'from_classroom_id' => $student->classroom_id,
                    'from_academic_year_id' => $student->academic_year_id,
                    'to_stage_id' => $data['to']['stage_id'],
                    'to_grade_id' => $data['to']['grade_id'],
                    'to_classroom_id' => $data['to']['classroom_id'],
                    'to_academic_year_id' => $data['to']['academic_year_id'],
                    'promoted_by' => $promotedBy->id,
                ]);

                $student->update([
                    'stage_id' => $data['to']['stage_id'],
                    'grade_id' => $data['to']['grade_id'],
                    'classroom_id' => $data['to']['classroom_id'],
                    'academic_year_id' => $data['to']['academic_year_id'],
                ]);

                return $promotion;
            });
        });
    }

    /**
     * The most specific field given wins — a classroom promotes just that
     * classroom, a grade promotes every classroom under it, a stage
     * promotes every grade under it. `except_student_ids` applies after.
     */
    private function resolveSourceStudents(array $from, array $exceptIds): Collection
    {
        $query = Student::query();

        if (! empty($from['classroom_id'])) {
            $query->where('classroom_id', $from['classroom_id']);
        } elseif (! empty($from['grade_id'])) {
            $query->where('grade_id', $from['grade_id']);
        } else {
            $query->where('stage_id', $from['stage_id']);
        }

        return $query->whereNotIn('id', $exceptIds)->lockForUpdate()->get();
    }

    /**
     * Counts the target classroom's current roster excluding the students
     * about to land there — necessary so promoting a classroom back into
     * itself (or any promotion where some students are already in the
     * target) doesn't double-count them against capacity.
     */
    private function assertClassroomHasRoom(int $classroomId, array $incomingStudentIds): void
    {
        $classroom = Classroom::lockForUpdate()->findOrFail($classroomId);

        if ($classroom->capacity === null) {
            return;
        }

        $currentCount = $classroom->students()->whereNotIn('id', $incomingStudentIds)->count();

        if ($currentCount + count($incomingStudentIds) > $classroom->capacity) {
            throw ValidationException::withMessages([
                'to.classroom_id' => __('This classroom does not have enough room for :count students.', [
                    'count' => count($incomingStudentIds),
                ]),
            ]);
        }
    }
}
