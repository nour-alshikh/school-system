<?php

namespace App\Http\Controllers;

use App\Http\Requests\Stage\StoreStageRequest;
use App\Http\Requests\Stage\UpdateStageRequest;
use App\Http\Resources\StageResource;
use App\Models\Stage;

class StageController extends Controller
{
    public function index()
    {
        return response()->json([
            'stages' => StageResource::collection(Stage::orderBy('id')->get()),
        ]);
    }

    public function store(StoreStageRequest $request)
    {
        $stage = Stage::create($request->validated());

        return response()->json(['stage' => new StageResource($stage)], 201);
    }

    public function update(UpdateStageRequest $request, Stage $stage)
    {
        $stage->update($request->validated());

        return response()->json(['stage' => new StageResource($stage)]);
    }

    public function destroy(Stage $stage)
    {
        $stage->delete();

        return response()->noContent();
    }
}
