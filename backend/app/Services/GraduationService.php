<?php

namespace App\Services;

use App\Enums\StudentStatus;
use App\Http\Requests\Graduation\StoreGraduationRequest;
use App\Models\Graduation;
use App\Models\Student;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GraduationService
{
    /**
     * Marks every active student in the given classroom (minus
     * except_student_ids) graduated and logs one Graduation row each — all
     * inside one transaction. Unlike PromotionService::promote there's no
     * destination classroom to check capacity against: a graduated student
     * leaves the active roster, they don't land in a new one.
     */
    public function graduate(StoreGraduationRequest $request, Authenticatable $graduatedBy): Collection
    {
        $data = $request->validated();
        $exceptIds = $data['except_student_ids'] ?? [];

        return DB::transaction(function () use ($data, $exceptIds, $graduatedBy) {
            $students = Student::where('classroom_id', $data['classroom_id'])
                ->where('status', StudentStatus::Active)
                ->whereNotIn('id', $exceptIds)
                ->lockForUpdate()
                ->get();

            if ($students->isEmpty()) {
                throw ValidationException::withMessages([
                    'classroom_id' => __('No students match the selected source.'),
                ]);
            }

            return $students->map(function (Student $student) use ($graduatedBy) {
                $graduation = Graduation::create([
                    'student_id' => $student->id,
                    'stage_id' => $student->stage_id,
                    'grade_id' => $student->grade_id,
                    'classroom_id' => $student->classroom_id,
                    'academic_year_id' => $student->academic_year_id,
                    'graduated_by' => $graduatedBy->id,
                ]);

                $student->update(['status' => StudentStatus::Graduated]);

                return $graduation;
            });
        });
    }

    /**
     * Rolls back one or more graduations, flipping the student back to
     * active and marking the row rolled back rather than deleting it — the
     * log stays complete either way. All-or-nothing: if any graduation in
     * the batch can't be rolled back, none are.
     *
     * Unlike a promotion, a graduation never changes stage/grade/classroom
     * on the student, so rollback has nothing to restore there and (unlike
     * PromotionService::rollbackMany) no capacity to recheck — just the
     * status flip back to active.
     */
    public function rollbackMany(array $graduationIds, Authenticatable $rolledBackBy): Collection
    {
        return DB::transaction(function () use ($graduationIds, $rolledBackBy) {
            $graduations = Graduation::with('student')
                ->whereIn('id', $graduationIds)
                ->lockForUpdate()
                ->get();

            foreach ($graduations as $graduation) {
                if ($graduation->rolled_back_at !== null) {
                    throw ValidationException::withMessages([
                        'graduation_ids' => __('This graduation has already been rolled back.'),
                    ]);
                }

                if ($graduation->student->status !== StudentStatus::Graduated) {
                    throw ValidationException::withMessages([
                        'graduation_ids' => __("This isn't this student's current graduation, so it can't be rolled back on its own."),
                    ]);
                }
            }

            foreach ($graduations as $graduation) {
                $graduation->student->update(['status' => StudentStatus::Active]);

                $graduation->update([
                    'rolled_back_at' => now(),
                    'rolled_back_by' => $rolledBackBy->id,
                ]);
            }

            return $graduations;
        });
    }
}
