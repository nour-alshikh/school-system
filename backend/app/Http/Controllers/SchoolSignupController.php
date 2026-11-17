<?php

namespace App\Http\Controllers;

use App\Http\Requests\SchoolSignup\CreateSchoolRequest;
use App\Http\Requests\SchoolSignup\SchoolSignupRequest;
use App\Models\PersonalAccessToken;
use App\Rules\SchoolSlug;
use App\Services\AuthService;
use App\Services\SchoolSignupService;
use Illuminate\Http\JsonResponse;

/**
 * Self-service schools. Both ways in answer like login — the user as admin
 * of the new school, and a token bound to it — so the BFF stores the cookie
 * and the frontend lands straight on the dashboard. See
 * docs/self-service-schools-plan.md.
 */
class SchoolSignupController extends Controller
{
    public function __construct(
        private readonly SchoolSignupService $signups,
        private readonly AuthService $auth,
    ) {}

    /** A guest: new account + new school. */
    public function signUp(SchoolSignupRequest $request): JsonResponse
    {
        return $this->respond($this->signups->signUp($request->validated()));
    }

    /** A signed-in user adds a school; the session moves to it, like switch-school. */
    public function store(CreateSchoolRequest $request): JsonResponse
    {
        $user = $request->user();
        $result = $this->signups->addSchool($user, $request->validated('school_name'), $request->validated('slug'), $request->validated('blueprint'));

        $current = $user->currentAccessToken();
        if ($current instanceof PersonalAccessToken) {
            $current->delete();
        }

        return $this->respond($result);
    }

    /** For the form's live check. A slug is public, so saying it's taken reveals nothing. */
    public function slugAvailability(string $slug): JsonResponse
    {
        $problem = SchoolSlug::problem($slug);

        return response()->json(array_filter([
            'available' => $problem === null,
            'reason' => $problem,
        ], fn ($value) => $value !== null));
    }

    private function respond(array $result): JsonResponse
    {
        $this->auth->markLoggedIn($result['user']);

        return response()->json([
            'user' => $this->auth->userAt($result['user'], $result['membership']),
            'token' => $result['token'],
        ], 201);
    }
}
