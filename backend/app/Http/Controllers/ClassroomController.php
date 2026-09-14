<?php

namespace App\Http\Controllers;

use App\Http\Requests\Classroom\StoreClassroomRequest;
use App\Http\Requests\Classroom\UpdateClassroomRequest;
use App\Http\Resources\ClassroomResource;
use App\Models\Classroom;
use Illuminate\Support\Facades\DB;

class ClassroomController extends Controller
{
    public function index()
    {
        return response()->json([
            'classrooms' => ClassroomResource::collection(Classroom::orderBy('id')->get()),
        ]);
    }

    public function store(StoreClassroomRequest $request)
    {
        $classrooms = DB::transaction(function () use ($request) {
            return collect($request->validated('classrooms'))
                ->map(fn (array $row) => Classroom::create($row));
        });

        return response()->json([
            'classrooms' => ClassroomResource::collection($classrooms),
        ], 201);
    }

    public function update(UpdateClassroomRequest $request, Classroom $classroom)
    {
        $classroom->update($request->validated());

        return response()->json(['classroom' => new ClassroomResource($classroom)]);
    }

    public function destroy(Classroom $classroom)
    {
        $classroom->delete();

        return response()->noContent();
    }
}
