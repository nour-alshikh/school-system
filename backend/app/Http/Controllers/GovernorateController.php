<?php

namespace App\Http\Controllers;

use App\Http\Resources\GovernorateResource;
use App\Models\Governorate;
use Illuminate\Http\Request;

class GovernorateController extends Controller
{
    public function index(Request $request)
    {
        $query = Governorate::orderBy('id');

        if ($nationalityId = $request->query('nationality_id')) {
            $query->where('nationality_id', $nationalityId);
        }

        return response()->json([
            'governorates' => GovernorateResource::collection($query->get()),
        ]);
    }
}
