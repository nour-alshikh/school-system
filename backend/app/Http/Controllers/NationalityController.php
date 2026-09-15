<?php

namespace App\Http\Controllers;

use App\Http\Resources\NationalityResource;
use App\Models\Nationality;

class NationalityController extends Controller
{
    public function index()
    {
        return response()->json([
            'nationalities' => NationalityResource::collection(Nationality::orderBy('id')->get()),
        ]);
    }
}
