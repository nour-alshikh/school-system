<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Http\Requests\ParentPortal\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use Illuminate\Support\Facades\Hash;

class ProfileController extends Controller
{
    public function update(UpdateProfileRequest $request)
    {
        $user = $request->user();
        $data = $request->validated();

        $user->name = $data['name'];
        $user->email = $data['email'];

        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();

        return response()->json(['user' => new UserResource($user)]);
    }
}
