<?php

namespace App\Http\Controllers;

use App\Http\Requests\Stage\StoreStageRequest;
use App\Http\Requests\Stage\UpdateStageRequest;
use App\Http\Resources\StageResource;
use App\Models\Stage;
use Illuminate\Http\Request;

class StageController extends Controller
{
    public function index(Request $request)
    {
        $query = Stage::orderBy('id');

        if ($search = $request->query('search')) {
            // name is a JSON-encoded {en, ar} string (see Stage::$translatable),
            // so a plain LIKE against the raw column also matches whichever
            // locale the term appears in.
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        // Paginated only when a page is asked for, so callers that just want
        // the full list for a dropdown (e.g. GradeForm's stage select) keep
        // working unchanged.
        if (! $request->has('page')) {
            return response()->json([
                'stages' => StageResource::collection($query->get()),
            ]);
        }

        $stages = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'stages' => StageResource::collection($stages),
            'meta' => [
                'current_page' => $stages->currentPage(),
                'last_page' => $stages->lastPage(),
                'per_page' => $stages->perPage(),
                'total' => $stages->total(),
            ],
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
        if ($stage->grades()->exists()) {
            return response()->json([
                'message' => 'This stage has grades and cannot be deleted.',
            ], 422);
        }

        $stage->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:stages,id'],
        ]);

        $stages = Stage::whereIn('id', $validated['ids'])->get();

        $withGrades = $stages->filter(fn (Stage $stage) => $stage->grades()->exists());

        if ($withGrades->isNotEmpty()) {
            return response()->json([
                'message' => 'Some stages have grades and cannot be deleted.',
            ], 422);
        }

        Stage::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }
}
