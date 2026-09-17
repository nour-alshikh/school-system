<?php

namespace App\Http\Controllers;

use App\Http\Requests\Graduation\RollbackGraduationsRequest;
use App\Http\Requests\Graduation\StoreGraduationRequest;
use App\Http\Resources\GraduationResource;
use App\Models\Graduation;
use App\Services\GraduationService;
use Illuminate\Http\Request;

class GraduationController extends Controller
{
    private const WITH = ['student', 'stage', 'grade', 'classroom', 'academicYear', 'graduatedBy', 'rolledBackBy'];

    public function __construct(private readonly GraduationService $graduationService) {}

    public function index(Request $request)
    {
        $query = Graduation::with(self::WITH)->orderByDesc('id');

        if ($studentId = $request->query('student_id')) {
            $query->where('student_id', $studentId);
        }

        if ($status = $request->query('status')) {
            if ($status === 'active') {
                $query->whereNull('rolled_back_at');
            } elseif ($status === 'rolled_back') {
                $query->whereNotNull('rolled_back_at');
            }
        }

        if ($classroomId = $request->query('classroom_id')) {
            $query->where('classroom_id', $classroomId);
        }

        if ($search = $request->query('search')) {
            $escaped = addcslashes($search, '%_\\');
            $query->whereHas('student', function ($studentQuery) use ($escaped) {
                $studentQuery->where('name->en', 'like', "%{$escaped}%")
                    ->orWhere('name->ar', 'like', "%{$escaped}%");
            });
        }

        if (! $request->has('page')) {
            return response()->json([
                'graduations' => GraduationResource::collection($query->get()),
            ]);
        }

        $graduations = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'graduations' => GraduationResource::collection($graduations),
            'meta' => [
                'current_page' => $graduations->currentPage(),
                'last_page' => $graduations->lastPage(),
                'per_page' => $graduations->perPage(),
                'total' => $graduations->total(),
            ],
        ]);
    }

    /**
     * Not a plain create — this is the bulk-graduate action. It resolves
     * every active student in the given classroom itself (see
     * GraduationService::graduate), so the response carries every
     * Graduation row it created rather than one.
     */
    public function store(StoreGraduationRequest $request)
    {
        $graduations = $this->graduationService
            ->graduate($request, $request->user())
            ->load(self::WITH);

        return response()->json([
            'graduated_count' => $graduations->count(),
            'graduations' => GraduationResource::collection($graduations),
        ], 201);
    }

    /**
     * Also bulk by default — a single row rolls back via a one-element
     * graduation_ids array, so the frontend's per-row button and its
     * multi-select "rollback selected" bar action share this one endpoint.
     */
    public function rollback(RollbackGraduationsRequest $request)
    {
        $graduations = $this->graduationService
            ->rollbackMany($request->validated('graduation_ids'), $request->user())
            ->load(self::WITH);

        return response()->json([
            'rolled_back_count' => $graduations->count(),
            'graduations' => GraduationResource::collection($graduations),
        ]);
    }
}
