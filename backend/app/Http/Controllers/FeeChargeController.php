<?php

namespace App\Http\Controllers;

use App\Enums\FeeChargeStatus;
use App\Http\Requests\FeeCharge\StoreFeeChargeRequest;
use App\Http\Requests\FeeCharge\StoreFeePaymentRequest;
use App\Http\Resources\FeeChargeResource;
use App\Models\Fee;
use App\Models\FeeCharge;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

class FeeChargeController extends Controller
{
    public function index(Student $student)
    {
        $charges = $student->feeCharges()
            ->with(['fee', 'payments.recordedBy'])
            ->orderByDesc('id')
            ->get();

        return response()->json(['fee_charges' => FeeChargeResource::collection($charges)]);
    }

    public function store(StoreFeeChargeRequest $request, Student $student)
    {
        $fees = Fee::whereIn('id', collect($request->validated('charges'))->pluck('fee_id'))
            ->get()
            ->keyBy('id');

        $charges = DB::transaction(function () use ($request, $student, $fees) {
            return collect($request->validated('charges'))->map(function (array $row) use ($student, $fees) {
                $fee = $fees[$row['fee_id']];

                return FeeCharge::create([
                    'student_id' => $student->id,
                    'fee_id' => $fee->id,
                    'academic_year_id' => $fee->academic_year_id,
                    'amount_due' => $row['amount_due'],
                    'status' => FeeChargeStatus::Unpaid,
                ]);
            });
        });

        return response()->json([
            'fee_charges' => FeeChargeResource::collection($charges->each->load(['fee', 'payments.recordedBy'])),
        ], 201);
    }

    public function destroy(FeeCharge $feeCharge)
    {
        if ($feeCharge->payments()->exists()) {
            return response()->json([
                'message' => 'This charge has payments recorded against it and cannot be deleted. Waive it instead.',
            ], 422);
        }

        $feeCharge->delete();

        return response()->noContent();
    }

    public function waive(FeeCharge $feeCharge)
    {
        $feeCharge->update(['status' => FeeChargeStatus::Waived]);

        return response()->json([
            'fee_charge' => new FeeChargeResource($feeCharge->load(['fee', 'payments.recordedBy'])),
        ]);
    }

    public function unwaive(FeeCharge $feeCharge)
    {
        if ($feeCharge->status !== FeeChargeStatus::Waived) {
            return response()->json([
                'message' => 'This charge has not been waived.',
            ], 422);
        }

        // recomputeStatus() no-ops while status is Waived, so this clears
        // the flag first, then lets it recompute from the payment ledger —
        // a charge waived after a partial payment goes back to Partial, not
        // straight to Unpaid.
        $feeCharge->status = FeeChargeStatus::Unpaid;
        $feeCharge->recomputeStatus();

        return response()->json([
            'fee_charge' => new FeeChargeResource($feeCharge->load(['fee', 'payments.recordedBy'])),
        ]);
    }

    public function storePayment(StoreFeePaymentRequest $request, FeeCharge $feeCharge)
    {
        if ($feeCharge->status === FeeChargeStatus::Waived) {
            return response()->json([
                'message' => 'This charge has been waived and cannot take payments.',
            ], 422);
        }

        $feeCharge->payments()->create([
            ...$request->validated(),
            'recorded_by_id' => $request->user()->id,
        ]);

        $feeCharge->recomputeStatus();

        return response()->json([
            'fee_charge' => new FeeChargeResource($feeCharge->load(['fee', 'payments.recordedBy'])),
        ], 201);
    }
}
