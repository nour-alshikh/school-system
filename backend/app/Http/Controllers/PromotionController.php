<?php

namespace App\Http\Controllers;

use App\Http\Requests\Promotion\RollbackPromotionsRequest;
use App\Http\Requests\Promotion\StorePromotionRequest;
use App\Http\Resources\PromotionResource;
use App\Models\Promotion;
use App\Services\PromotionService;
use Illuminate\Http\Request;

class PromotionController extends Controller
{
    private const WITH = [
        'student', 'fromStage', 'fromGrade', 'fromClassroom', 'fromAcademicYear',
        'toStage', 'toGrade', 'toClassroom', 'toAcademicYear', 'promotedBy', 'rolledBackBy',
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
     * Not a plain create — this is the bulk-promote action. It resolves
     * every student in the given classroom itself (see
     * PromotionService::promote), so the response carries every Promotion
     * row it created rather than one.
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

    /**
     * Also bulk by default — a single row rolls back via a one-element
     * promotion_ids array, so the frontend's per-row button and its
     * multi-select "rollback selected" bar action share this one endpoint.
     */
    public function rollback(RollbackPromotionsRequest $request)
    {
        $promotions = $this->promotionService
            ->rollbackMany($request->validated('promotion_ids'), $request->user())
            ->load(self::WITH);

        return response()->json([
            'rolled_back_count' => $promotions->count(),
            'promotions' => PromotionResource::collection($promotions),
        ]);
    }
}
