<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\UserResource;
use App\Models\User;
use App\Tenancy\TenantContext;

class UserController extends Controller
{
    public function index()
    {
        return response()->json([
            // Users are global; list only the ones who belong to this school.
            'users' => UserResource::collection(
                User::whereHas('memberships', fn ($q) => $q->where('school_id', app(TenantContext::class)->id()))
                    ->with('roles')
                    ->get()
            ),
        ]);
    }
}
