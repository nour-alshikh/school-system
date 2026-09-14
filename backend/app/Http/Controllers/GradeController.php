<?php

namespace App\Http\Controllers;

use App\Http\Requests\Grade\StoreGradeRequest;
use App\Http\Requests\Grade\UpdateGradeRequest;
use App\Http\Resources\GradeResource;
use App\Models\Grade;
use Illuminate\Http\Request;

class GradeController extends Controller
{
    public function index(Request $request)
    {
        $query = Grade::orderBy('id');

        if ($search = $request->query('search')) {
            // name is a JSON-encoded {en, ar} string (see Grade::$translatable),
            // so a plain LIKE against the raw column also matches whichever
            // locale the term appears in.
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        if ($stageId = $request->query('stage_id')) {
            $query->where('stage_id', $stageId);
        }

        // Paginated only when a page is asked for, so callers that just want
        // the full list for a dropdown or name lookup (e.g. ClassroomsPage)
        // keep working unchanged.
        if (! $request->has('page')) {
            return response()->json([
                'grades' => GradeResource::collection($query->get()),
            ]);
        }

        $grades = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'grades' => GradeResource::collection($grades),
            'meta' => [
                'current_page' => $grades->currentPage(),
                'last_page' => $grades->lastPage(),
                'per_page' => $grades->perPage(),
                'total' => $grades->total(),
            ],
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
        if ($grade->classrooms()->exists()) {
            return response()->json([
                'message' => 'This grade has classrooms and cannot be deleted.',
            ], 422);
        }

        $grade->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:grades,id'],
        ]);

        $grades = Grade::whereIn('id', $validated['ids'])->get();

        $withClassrooms = $grades->filter(fn (Grade $grade) => $grade->classrooms()->exists());

        if ($withClassrooms->isNotEmpty()) {
            return response()->json([
                'message' => 'Some grades have classrooms and cannot be deleted.',
            ], 422);
        }

        Grade::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }
}
