<?php

namespace App\Http\Controllers;

use App\Http\Requests\Classroom\StoreClassroomRequest;
use App\Http\Requests\Classroom\UpdateClassroomRequest;
use App\Http\Resources\ClassroomResource;
use App\Models\Classroom;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassroomController extends Controller
{
    public function index(Request $request)
    {
        $query = Classroom::orderBy('id');

        if ($search = $request->query('search')) {
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        if ($gradeId = $request->query('grade_id')) {
            $query->where('grade_id', $gradeId);
        }

        if ($stageId = $request->query('stage_id')) {
            $query->whereHas('grade', fn ($q) => $q->where('stage_id', $stageId));
        }

        // Paginated only when a page is asked for, so callers that just want
        // the full list for a dropdown keep working unchanged.
        if (! $request->has('page')) {
            return response()->json([
                'classrooms' => ClassroomResource::collection($query->get()),
            ]);
        }

        $classrooms = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'classrooms' => ClassroomResource::collection($classrooms),
            'meta' => [
                'current_page' => $classrooms->currentPage(),
                'last_page' => $classrooms->lastPage(),
                'per_page' => $classrooms->perPage(),
                'total' => $classrooms->total(),
            ],
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

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:classrooms,id'],
        ]);

        Classroom::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }
}
