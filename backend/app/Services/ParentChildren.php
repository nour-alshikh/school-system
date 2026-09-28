<?php

namespace App\Services;

use App\Enums\MembershipRole;
use App\Models\Student;
use App\Models\User;
use App\Tenancy\TenantContext;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\Response;

/**
 * A parent's children across every school they are a parent at — the one
 * deliberate cross-school read in the app (docs/multi-tenancy.md,
 * Decisions). Limited to students whose parent_user_id is this user, at
 * schools where they hold a usable parent membership.
 *
 * Each school's children are loaded inside that school's context, so their
 * school-scoped relations (grade, classroom, ...) resolve correctly.
 */
class ParentChildren
{
    public const WITH = [
        'school', 'user', 'parentUser', 'father', 'mother', 'stage', 'grade', 'classroom',
        'academicYear', 'nationality', 'governorate', 'bloodType', 'media',
    ];

    public function __construct(
        private readonly TenantContext $context,
        private readonly MembershipService $memberships,
    ) {}

    /**
     * @return Collection<int, Student> Current school's children first, then by school and id.
     */
    public function all(User $parent): Collection
    {
        $currentSchoolId = $this->context->has() ? $this->context->id() : null;

        return $this->memberships->usable($parent, MembershipRole::Parent)
            ->sortBy(fn ($m) => $m->school_id === $currentSchoolId ? 0 : 1)
            ->flatMap(fn ($membership) => $this->context->runAs(
                $membership->school,
                fn () => Student::with(self::WITH)
                    ->where('parent_user_id', $parent->id)
                    ->orderBy('id')
                    ->get(),
            ))
            ->values();
    }

    /**
     * The child a parent-portal request is about: $studentId if given (must
     * be one of theirs), else their first child. Switches the request to
     * that child's school, so everything read afterwards — attendance,
     * fees, library — is that school's.
     */
    public function resolve(User $parent, ?int $studentId): Student
    {
        $children = $this->all($parent);

        $student = $studentId === null
            ? $children->first()
            : $children->firstWhere('id', $studentId);

        abort_if($student === null, $studentId === null ? Response::HTTP_FORBIDDEN : Response::HTTP_NOT_FOUND);

        $this->context->set($student->school);

        return $student;
    }
}
