<?php

namespace App\Http\Controllers;

use App\Http\Resources\ReligionResource;
use App\Models\Religion;

class ReligionController extends Controller
{
    public function index()
    {
        return response()->json([
            'religions' => ReligionResource::collection(Religion::orderBy('id')->get()),
        ]);
    }
}
