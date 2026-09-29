<?php

namespace App\Http\Controllers\Platform;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Platform\SchoolMembers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * A school's admins and members, from the central dashboard
 * (docs/central-dashboard-plan.md, phase 6).
 */
class MemberController extends Controller
{
    public function __construct(private readonly SchoolMembers $members) {}

    /** Everyone at the school: name, email, role, status, last seen. Filterable. */
    public function index(Request $request, School $school): JsonResponse
    {
        $filters = $request->validate([
            'role' => ['nullable', Rule::enum(MembershipRole::class)],
            'status' => ['nullable', Rule::enum(MembershipStatus::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $members = SchoolMembership::with('user:id,name,email,last_login_at')
            ->where('school_id', $school->id)
            ->when($filters['role'] ?? null, fn ($q, $role) => $q->where('role', $role))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['search'] ?? null, fn ($q, $term) => $q->whereHas('user', fn ($u) => $u
                ->where('name', 'like', '%'.addcslashes($term, '%_\\').'%')
                ->orWhere('email', 'like', '%'.addcslashes($term, '%_\\').'%')))
            ->orderByRaw("case role when 'admin' then 0 when 'teacher' then 1 when 'parent' then 2 else 3 end")
            ->orderBy('id')
            ->paginate(25);

        return response()->json([
            'members' => collect($members->items())->map(fn (SchoolMembership $m) => [
                'id' => $m->id,
                'role' => $m->role->value,
                'status' => $m->status->value,
                'last_seen_at' => $m->last_seen_at?->toJSON(),
                'user' => [
                    'id' => $m->user->id,
                    'name' => $m->user->name,
                    'email' => $m->user->email,
                    'last_login_at' => $m->user->last_login_at?->toJSON(),
                ],
            ])->all(),
            'meta' => [
                'current_page' => $members->currentPage(),
                'last_page' => $members->lastPage(),
                'per_page' => $members->perPage(),
                'total' => $members->total(),
            ],
        ]);
    }

    public function addAdmin(Request $request, School $school): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
        ]);

        ['user' => $user, 'invited' => $invited] = $this->members->addAdmin($school, $data['name'], $data['email']);

        return response()->json(['user' => $user->only(['id', 'name', 'email']), 'invited' => $invited], 201);
    }

    public function removeAdmin(School $school, User $user): Response
    {
        $this->members->removeAdmin($school, $user);

        return response()->noContent();
    }

    public function update(Request $request, School $school, SchoolMembership $membership): Response
    {
        $this->ensureAtSchool($school, $membership);
        $data = $request->validate(['status' => ['required', Rule::in([MembershipStatus::Active->value, MembershipStatus::Suspended->value])]]);

        $this->members->setStatus($membership, MembershipStatus::from($data['status']));

        return response()->noContent();
    }

    public function sendPasswordReset(School $school, SchoolMembership $membership): Response
    {
        $this->ensureAtSchool($school, $membership);
        $this->members->sendPasswordReset($membership);

        return response()->noContent();
    }

    private function ensureAtSchool(School $school, SchoolMembership $membership): void
    {
        abort_unless($membership->school_id === $school->id, 404);
    }
}
