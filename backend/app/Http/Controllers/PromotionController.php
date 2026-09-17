<?php

namespace App\Http\Controllers;

use App\Http\Requests\Promotion\StorePromotionRequest;
use App\Http\Resources\PromotionResource;
use App\Models\Promotion;
use App\Services\PromotionService;
use Illuminate\Http\Request;

class PromotionController extends Controller
{
    private const WITH = [
        'student', 'fromStage', 'fromGrade', 'fromClassroom', 'fromAcademicYear',
        'toStage', 'toGrade', 'toClassroom', 'toAcademicYear', 'promotedBy',
    ];

    public function __construct(private readonly PromotionService $promotionService) {}

    public function index(Request $request)
    {
        $query = Promotion::with(self::WITH)->orderByDesc('id');

        if ($studentId = $request->query('student_id')) {
            $query->where('student_id', $studentId);
        }

        if (! $request->has('page')) {
            return response()->json([
                'promotions' => PromotionResource::collection($query->get()),
            ]);
        }

        $promotions = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'promotions' => PromotionResource::collection($promotions),
            'meta' => [
                'current_page' => $promotions->currentPage(),
                'last_page' => $promotions->lastPage(),
                'per_page' => $promotions->perPage(),
                'total' => $promotions->total(),
            ],
        ]);
    }

    /**
     * Not a plain create — this is the bulk-promote action. It resolves the
     * source set itself (see PromotionService::resolveSourceStudents), so
     * the response carries every Promotion row it created rather than one.
     */
    public function store(StorePromotionRequest $request)
    {
        $promotions = $this->promotionService
            ->promote($request, $request->user())
            ->load(self::WITH);

        return response()->json([
            'promoted_count' => $promotions->count(),
            'promotions' => PromotionResource::collection($promotions),
        ], 201);
    }
}
