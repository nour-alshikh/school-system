<?php

namespace App\Http\Controllers;

use App\Http\Requests\Subject\StoreSubjectRequest;
use App\Http\Requests\Subject\UpdateSubjectRequest;
use App\Http\Resources\SubjectResource;
use App\Models\Grade;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index(Request $request)
    {
        $query = Subject::with(['stages', 'grades'])->orderBy('id');

        if ($search = $request->query('search')) {
            // name is a JSON-encoded {en, ar} string (see Subject::$translatable),
            // so a plain LIKE against the raw column also matches whichever
            // locale the term appears in.
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        // "Subjects taught in this grade" — either scoped directly to the
        // grade, or to the whole stage the grade belongs to (Subject has
        // exactly one of those scopes, see Subject::stages()/grades()).
        if ($gradeId = $request->query('grade_id')) {
            $grade = Grade::find($gradeId);

            $query->where(function ($q) use ($gradeId, $grade) {
                $q->whereHas('grades', fn ($qq) => $qq->where('grades.id', $gradeId));

                if ($grade) {
                    $q->orWhereHas('stages', fn ($qq) => $qq->where('stages.id', $grade->stage_id));
                }
            });
        }

        if (! $request->has('page')) {
            return response()->json([
                'subjects' => SubjectResource::collection($query->get()),
            ]);
        }

        $subjects = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'subjects' => SubjectResource::collection($subjects),
            'meta' => [
                'current_page' => $subjects->currentPage(),
                'last_page' => $subjects->lastPage(),
                'per_page' => $subjects->perPage(),
                'total' => $subjects->total(),
            ],
        ]);
    }

    public function store(StoreSubjectRequest $request)
    {
        $subject = Subject::create($request->safe()->only('name'));
        $subject->stages()->sync($request->input('stage_ids', []));
        $subject->grades()->sync($request->input('grade_ids', []));

        return response()->json(['subject' => new SubjectResource($subject->load(['stages', 'grades']))], 201);
    }

    public function update(UpdateSubjectRequest $request, Subject $subject)
    {
        $subject->update($request->safe()->only('name'));
        $subject->stages()->sync($request->input('stage_ids', []));
        $subject->grades()->sync($request->input('grade_ids', []));

        return response()->json(['subject' => new SubjectResource($subject->load(['stages', 'grades']))]);
    }

    public function destroy(Subject $subject)
    {
        if ($subject->teachers()->exists()) {
            return response()->json([
                'message' => 'This subject is assigned to teachers and cannot be deleted.',
            ], 422);
        }

        $subject->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:subjects,id'],
        ]);

        $subjects = Subject::whereIn('id', $validated['ids'])->get();

        $withTeachers = $subjects->filter(fn (Subject $subject) => $subject->teachers()->exists());

        if ($withTeachers->isNotEmpty()) {
            return response()->json([
                'message' => 'Some subjects are assigned to teachers and cannot be deleted.',
            ], 422);
        }

        Subject::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }
}
