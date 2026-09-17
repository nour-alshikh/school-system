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
            $students = Student::where('classroom_id', $data['from']['classroom_id'])
                ->whereNotIn('id', $exceptIds)
                ->lockForUpdate()
                ->get();

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
     * Rolls back one or more promotions, undoing each student's stage/
     * grade/classroom/academic_year and marking the row rolled back rather
     * than deleting it — the log stays complete either way. All-or-nothing:
     * if any promotion in the batch can't be rolled back, none are.
     *
     * A promotion can only be rolled back while it's still the student's
     * current state — if the student's live record doesn't match this
     * promotion's `to_*` snapshot (a later promotion, or a manual edit,
     * moved them since), rolling back would silently discard whatever
     * happened after, so it's refused instead.
     */
    public function rollbackMany(array $promotionIds, Authenticatable $rolledBackBy): Collection
    {
        return DB::transaction(function () use ($promotionIds, $rolledBackBy) {
            $promotions = Promotion::with('student')
                ->whereIn('id', $promotionIds)
                ->lockForUpdate()
                ->get();

            // Grouped by destination classroom so a batch that sends
            // several students back to the same classroom is checked
            // against that classroom's capacity as a whole, not one at a
            // time (same reasoning as promote()'s capacity check).
            $incomingByClassroom = [];

            foreach ($promotions as $promotion) {
                if ($promotion->rolled_back_at !== null) {
                    throw ValidationException::withMessages([
                        'promotion_ids' => __('This promotion has already been rolled back.'),
                    ]);
                }

                $student = $promotion->student;

                $stillAtDestination = $student->stage_id === $promotion->to_stage_id
                    && $student->grade_id === $promotion->to_grade_id
                    && $student->classroom_id === $promotion->to_classroom_id
                    && $student->academic_year_id === $promotion->to_academic_year_id;

                if (! $stillAtDestination) {
                    throw ValidationException::withMessages([
                        'promotion_ids' => __("This isn't this student's most recent promotion, so it can't be rolled back on its own."),
                    ]);
                }

                $incomingByClassroom[$promotion->from_classroom_id][] = $student->id;
            }

            foreach ($incomingByClassroom as $classroomId => $studentIds) {
                $this->assertClassroomHasRoom($classroomId, $studentIds);
            }

            foreach ($promotions as $promotion) {
                $promotion->student->update([
                    'stage_id' => $promotion->from_stage_id,
                    'grade_id' => $promotion->from_grade_id,
                    'classroom_id' => $promotion->from_classroom_id,
                    'academic_year_id' => $promotion->from_academic_year_id,
                ]);

                $promotion->update([
                    'rolled_back_at' => now(),
                    'rolled_back_by' => $rolledBackBy->id,
                ]);
            }

            return $promotions;
        });
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
