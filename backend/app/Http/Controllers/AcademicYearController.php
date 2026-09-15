<?php

namespace App\Http\Controllers;

use App\Http\Requests\AcademicYear\StoreAcademicYearRequest;
use App\Http\Requests\AcademicYear\UpdateAcademicYearRequest;
use App\Http\Resources\AcademicYearResource;
use App\Models\AcademicYear;
use App\Services\AcademicYearService;
use Illuminate\Http\Request;

class AcademicYearController extends Controller
{
    public function __construct(private readonly AcademicYearService $academicYearService) {}

    public function index(Request $request)
    {
        $query = AcademicYear::orderBy('id');

        if ($search = $request->query('search')) {
            $query->where('year', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        if (! $request->has('page')) {
            return response()->json([
                'academic_years' => AcademicYearResource::collection($query->get()),
            ]);
        }

        $academicYears = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'academic_years' => AcademicYearResource::collection($academicYears),
            'meta' => [
                'current_page' => $academicYears->currentPage(),
                'last_page' => $academicYears->lastPage(),
                'per_page' => $academicYears->perPage(),
                'total' => $academicYears->total(),
            ],
        ]);
    }

    public function store(StoreAcademicYearRequest $request)
    {
        $academicYear = $this->academicYearService->create($request);

        return response()->json(['academic_year' => new AcademicYearResource($academicYear)], 201);
    }

    public function update(UpdateAcademicYearRequest $request, AcademicYear $academicYear)
    {
        $academicYear = $this->academicYearService->update($request, $academicYear);

        return response()->json(['academic_year' => new AcademicYearResource($academicYear)]);
    }

    public function destroy(AcademicYear $academicYear)
    {
        if ($academicYear->students()->exists()) {
            return response()->json([
                'message' => 'This academic year has students and cannot be deleted.',
            ], 422);
        }

        $academicYear->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:academic_years,id'],
        ]);

        $academicYears = AcademicYear::whereIn('id', $validated['ids'])->get();

        $withStudents = $academicYears->filter(fn (AcademicYear $academicYear) => $academicYear->students()->exists());

        if ($withStudents->isNotEmpty()) {
            return response()->json([
                'message' => 'Some academic years have students and cannot be deleted.',
            ], 422);
        }

        AcademicYear::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }
}
