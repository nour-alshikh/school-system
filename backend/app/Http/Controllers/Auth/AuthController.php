<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\PersonalAccessToken;
use App\Models\SchoolMembership;
use App\Models\User;
use App\Services\AuthService;
use App\Services\MembershipService;
use App\Tenancy\TenantContext;
use App\TypeScript\SchoolMembershipType;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    public function register(RegisterRequest $request)
    {
        ['user' => $user, 'token' => $token] = $this->authService->register($request);

        return response()->json(['user' => new UserResource($user), 'token' => $token]);
    }

    public function login(LoginRequest $request)
    {
        $result = $this->authService->login($request);

        // Same role at several schools: the frontend shows a school picker
        // and resubmits with school_id. Shaped like a validation error so
        // the form can show the message inline.
        if (isset($result['choose'])) {
            return response()->json([
                'message' => __('auth.choose_school'),
                'errors' => ['school_id' => [__('auth.choose_school')]],
                'schools' => $result['choose']->map(fn (SchoolMembership $m) => SchoolMembershipType::fromModel($m))->values(),
            ], 422);
        }

        return response()->json([
            'user' => $this->userAt($result['user'], $result['membership']),
            'token' => $result['token'],
        ]);
    }

    /**
     * Moves the session to another of the user's memberships (another
     * school, or another role at the same school): issues a token bound to
     * it and revokes the current one. The BFF swaps the cookie like it does
     * on login.
     */
    public function switchSchool(Request $request, MembershipService $memberships)
    {
        $request->validate(['membership_id' => ['required', 'integer']]);

        $user = $request->user();
        $membership = $memberships->usable($user)->firstWhere('id', (int) $request->membership_id);
        abort_if($membership === null, 403, __('auth.school_not_available'));

        $token = $memberships->issueToken($user, $membership);

        $current = $user->currentAccessToken();
        if ($current instanceof PersonalAccessToken) {
            $current->delete();
        }

        return response()->json(['user' => $this->userAt($user, $membership), 'token' => $token]);
    }

    /**
     * The user as seen from $membership's school. This request was resolved
     * for another school (or none), and roles/permissions are per school, so
     * switch before reading them.
     */
    private function userAt(User $user, SchoolMembership $membership): UserResource
    {
        app(TenantContext::class)->set($membership->school);
        $user->unsetRelation('roles')->unsetRelation('permissions');

        return new UserResource($user, $membership);
    }

    public function logout(Request $request)
    {
        $this->authService->logout($request);

        return response()->noContent();
    }

    public function user(Request $request)
    {
        return response()->json(['user' => new UserResource($request->user())]);
    }
}
