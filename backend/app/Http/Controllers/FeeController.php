<?php

namespace App\Http\Controllers;

use App\Enums\FeeChargeStatus;
use App\Enums\StudentStatus;
use App\Http\Requests\Fee\ChargeAllFeeRequest;
use App\Http\Requests\Fee\StoreFeeRequest;
use App\Http\Requests\Fee\UpdateFeeRequest;
use App\Http\Resources\FeeMatchingStudentResource;
use App\Http\Resources\FeeResource;
use App\Models\Fee;
use App\Models\FeeCharge;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FeeController extends Controller
{
    public function index(Request $request)
    {
        $query = Fee::with(['academicYear', 'stage', 'grade'])->orderBy('id');

        if ($search = $request->query('search')) {
            // name is a JSON-encoded {en, ar} string (see Fee::$translatable),
            // so a plain LIKE against the raw column also matches whichever
            // locale the term appears in.
            $query->where('name', 'like', '%'.addcslashes($search, '%_\\').'%');
        }

        if ($academicYearId = $request->query('academic_year_id')) {
            $query->where('academic_year_id', $academicYearId);
        }

        if (! $request->has('page')) {
            return response()->json([
                'fees' => FeeResource::collection($query->get()),
            ]);
        }

        $fees = $query->paginate($request->integer('per_page', 10));

        return response()->json([
            'fees' => FeeResource::collection($fees),
            'meta' => [
                'current_page' => $fees->currentPage(),
                'last_page' => $fees->lastPage(),
                'per_page' => $fees->perPage(),
                'total' => $fees->total(),
            ],
        ]);
    }

    public function store(StoreFeeRequest $request)
    {
        $fee = Fee::create([
            ...$request->safe()->only(['academic_year_id', 'amount', 'is_active', 'is_for_all']),
            'name' => $request->input('name'),
            'stage_id' => $request->boolean('is_for_all') ? null : $request->input('stage_id'),
            'grade_id' => $request->boolean('is_for_all') ? null : $request->input('grade_id'),
        ]);

        return response()->json(['fee' => new FeeResource($fee->load(['academicYear', 'stage', 'grade']))], 201);
    }

    public function update(UpdateFeeRequest $request, Fee $fee)
    {
        $fee->update([
            ...$request->safe()->only(['academic_year_id', 'amount', 'is_active', 'is_for_all']),
            'name' => $request->input('name'),
            'stage_id' => $request->boolean('is_for_all') ? null : $request->input('stage_id'),
            'grade_id' => $request->boolean('is_for_all') ? null : $request->input('grade_id'),
        ]);

        return response()->json(['fee' => new FeeResource($fee->load(['academicYear', 'stage', 'grade']))]);
    }

    public function destroy(Fee $fee)
    {
        if ($fee->charges()->exists()) {
            return response()->json([
                'message' => 'This fee has been charged to students and cannot be deleted.',
            ], 422);
        }

        $fee->delete();

        return response()->noContent();
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:fees,id'],
        ]);

        $fees = Fee::whereIn('id', $validated['ids'])->get();

        $withCharges = $fees->filter(fn (Fee $fee) => $fee->charges()->exists());

        if ($withCharges->isNotEmpty()) {
            return response()->json([
                'message' => 'Some fees have been charged to students and cannot be deleted.',
            ], 422);
        }

        Fee::whereIn('id', $validated['ids'])->delete();

        return response()->noContent();
    }

    /**
     * Students this fee applies to (is_for_all, or its exact stage+grade)
     * who are active in the fee's academic year and don't already have a
     * charge for it — the review step's candidate list for "charge all".
     */
    public function matchingStudents(Fee $fee)
    {
        $query = Student::where('academic_year_id', $fee->academic_year_id)
            ->where('status', StudentStatus::Active)
            ->whereDoesntHave('feeCharges', fn ($q) => $q->where('fee_id', $fee->id));

        if (! $fee->is_for_all) {
            $query->where('stage_id', $fee->stage_id)->where('grade_id', $fee->grade_id);
        }

        $students = $query->orderBy('id')->get();

        return response()->json(['students' => FeeMatchingStudentResource::collection($students)]);
    }

    public function chargeAll(ChargeAllFeeRequest $request, Fee $fee)
    {
        $charges = DB::transaction(function () use ($request, $fee) {
            return collect($request->validated('charges'))->map(fn (array $row) => FeeCharge::create([
                'student_id' => $row['student_id'],
                'fee_id' => $fee->id,
                'academic_year_id' => $fee->academic_year_id,
                'amount_due' => $row['amount_due'],
                'status' => FeeChargeStatus::Unpaid,
            ]));
        });

        return response()->json(['charged_count' => $charges->count()], 201);
    }
}
