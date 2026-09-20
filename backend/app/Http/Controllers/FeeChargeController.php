<?php

namespace App\Http\Controllers;

use App\Enums\FeeChargeStatus;
use App\Http\Requests\FeeCharge\StoreFeeChargeRequest;
use App\Http\Requests\FeeCharge\StoreFeePaymentRequest;
use App\Http\Resources\FeeChargeResource;
use App\Models\Fee;
use App\Models\FeeCharge;
use App\Models\Student;

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
        $fee = Fee::findOrFail($request->integer('fee_id'));

        $charge = FeeCharge::create([
            'student_id' => $student->id,
            'fee_id' => $fee->id,
            'academic_year_id' => $fee->academic_year_id,
            'amount_due' => $request->input('amount_due'),
            'status' => FeeChargeStatus::Unpaid,
        ]);

        return response()->json([
            'fee_charge' => new FeeChargeResource($charge->load(['fee', 'payments.recordedBy'])),
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
