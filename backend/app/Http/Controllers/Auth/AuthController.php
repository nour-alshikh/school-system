<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
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
        ['user' => $user, 'token' => $token] = $this->authService->login($request);

        return response()->json(['user' => new UserResource($user), 'token' => $token]);
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
