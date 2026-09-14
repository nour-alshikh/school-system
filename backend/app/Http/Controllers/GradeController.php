<?php

namespace App\Http\Controllers;

use App\Http\Requests\Grade\StoreGradeRequest;
use App\Http\Requests\Grade\UpdateGradeRequest;
use App\Http\Resources\GradeResource;
use App\Models\Grade;

class GradeController extends Controller
{
    public function index()
    {
        return response()->json([
            'grades' => GradeResource::collection(Grade::orderBy('id')->get()),
        ]);
    }

    public function store(StoreGradeRequest $request)
    {
        $grade = Grade::create($request->validated());

        return response()->json(['grade' => new GradeResource($grade)], 201);
    }

    public function update(UpdateGradeRequest $request, Grade $grade)
    {
        $grade->update($request->validated());

        return response()->json(['grade' => new GradeResource($grade)]);
    }

    public function destroy(Grade $grade)
    {
        $grade->delete();

        return response()->noContent();
    }
}
