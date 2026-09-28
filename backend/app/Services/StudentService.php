<?php

namespace App\Services;

use App\Enums\MembershipRole;
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
    public function __construct(private readonly MembershipService $memberships) {}

    private const WITH = [
        'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom',
        'academicYear', 'nationality', 'governorate', 'bloodType', 'media',
    ];

    public function register(StoreStudentRequest $request): Student
    {
        $data = $request->validated();

        return DB::transaction(function () use ($data) {
            $this->assertClassroomHasRoom((int) $data['student']['classroom_id']);

            // A sibling's parent (at this school or another) already has an
            // account: link this child to it instead of creating a second one.
            // Its password is left alone — the parent keeps signing in as before.
            $parentUser = User::where('email', $data['parent']['email'])->first()
                ?? User::create([
                    'name' => $data['father']['name'],
                    'email' => $data['parent']['email'],
                    'password' => Hash::make($data['parent']['password']),
                ]);
            $this->memberships->grant($parentUser, MembershipRole::Parent);

            $studentUser = User::create([
                'name' => $data['student']['name']['en'],
                'email' => $data['student']['email'],
                'password' => Hash::make($data['student']['password']),
            ]);
            $this->memberships->grant($studentUser, MembershipRole::Student);

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
                $this->assertCanManageParentAccount($student->parentUser, $data['parent']);

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
     * Deletes the whole registration, not just the Student row. Deleting
     * the student's own account cascades the Student row away
     * (`students.user_id` is `cascadeOnDelete`; father/mother/media cascade
     * from there).
     *
     * The parent account may be shared with siblings, here or at another
     * school — and `students.parent_user_id` is also `cascadeOnDelete`, so
     * deleting it would take those siblings with it. It is only deleted when
     * this was its last child and it belongs to no other school; otherwise it
     * just stops being a parent here once it has no children left here.
     */
    public function delete(Student $student): void
    {
        DB::transaction(function () use ($student) {
            $parentUser = $student->parentUser;

            $student->user->delete();

            if (! $parentUser) {
                return;
            }

            $otherChildren = Student::withoutSchoolScope()->where('parent_user_id', $parentUser->id);

            if ($otherChildren->doesntExist() && $this->memberships->onlyInCurrentSchool($parentUser) && ! $this->hasOtherRolesHere($parentUser) && ! $parentUser->is_platform_admin) {
                $parentUser->delete();
            } elseif (Student::where('parent_user_id', $parentUser->id)->doesntExist()) {
                $this->memberships->revoke($parentUser, MembershipRole::Parent);
            }
        });
    }

    /**
     * A parent account used at another school is the parent's own: this
     * school can link children to it but not change how it signs in.
     *
     * @param  array<string, mixed>  $parent
     */
    private function assertCanManageParentAccount(User $parentUser, array $parent): void
    {
        $changesEmail = isset($parent['email']) && $parent['email'] !== $parentUser->email;
        $changesPassword = ! empty($parent['password']);

        if (($changesEmail || $changesPassword) && ! $this->memberships->onlyInCurrentSchool($parentUser)) {
            throw ValidationException::withMessages([
                'parent.email' => __('validation.parent_account_shared'),
            ]);
        }
    }

    /** E.g. the parent is also a teacher here: keep the account. */
    private function hasOtherRolesHere(User $user): bool
    {
        return $user->memberships()->where('role', '!=', MembershipRole::Parent)->exists();
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
