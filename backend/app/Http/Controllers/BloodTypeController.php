<?php

namespace App\Http\Controllers;

use App\Http\Resources\BloodTypeResource;
use App\Models\BloodType;

class BloodTypeController extends Controller
{
    public function index()
    {
        return response()->json([
            'blood_types' => BloodTypeResource::collection(BloodType::orderBy('id')->get()),
        ]);
    }
}
