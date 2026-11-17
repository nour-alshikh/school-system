<?php

namespace App\Services\Ai\Assistant;

use App\Models\Classroom;
use App\Models\School;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Who a tool runs as: the signed-in user at the current school, with the
 * same checks the pages behind each tool use (docs/ai-assistant-plan.md,
 * rule 2). Every tool scopes its queries through these, never through
 * anything the model sent.
 */
final class ToolContext
{
    /** @var list<string> */
    public readonly array $roles;

    /** @var list<string> */
    public readonly array $permissions;

    /** @var list<string> */
    public readonly array $features;

    private ?Teacher $teacherModel = null;

    private bool $teacherLoaded = false;

    public function __construct(public readonly User $user, public readonly School $school)
    {
        $this->roles = $user->getRoleNames()->values()->all();
        $this->permissions = $user->getAllPermissions()->pluck('name')->values()->all();
        $this->features = $school->effectivePlan()->features ?? [];
    }

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions, true);
    }

    public function hasRole(string $role): bool
    {
        return in_array($role, $this->roles, true);
    }

    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->features, true);
    }

    public function teacher(): ?Teacher
    {
        if (! $this->teacherLoaded) {
            $this->teacherModel = $this->hasRole('teacher') ? $this->user->teacher : null;
            $this->teacherLoaded = true;
        }

        return $this->teacherModel;
    }

    /**
     * Classrooms whose attendance this user may read: every one with
     * manage-attendance, else the ones a teacher teaches — as
     * AttendanceController::classrooms().
     */
    public function attendanceClassrooms(): Builder
    {
        $query = Classroom::with('grade')->orderBy('id');

        if ($this->can('manage-attendance')) {
            return $query;
        }

        $teacher = $this->teacher();

        return $teacher
            ? $query->whereIn('id', $teacher->classroomSubjects()->pluck('classroom_id'))
            : $query->whereRaw('1 = 0');
    }

    /** This parent's children at the current school. */
    public function children(): Collection
    {
        return $this->hasRole('parent')
            ? Student::with(['grade', 'classroom.grade'])->where('parent_user_id', $this->user->id)->orderBy('id')->get()
            : collect();
    }

    /** The signed-in student's own record at this school. */
    public function student(): ?Student
    {
        return $this->hasRole('student')
            ? Student::with(['grade', 'classroom.grade'])->where('user_id', $this->user->id)->first()
            : null;
    }
}
