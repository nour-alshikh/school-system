<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\TypeScript\FeeChargeType;
use App\TypeScript\StudentFeesSummaryType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FeeController extends Controller
{
    /**
     * This parent's child's full fee charge ledger — read-only, same shape
     * as StudentPortal\FeeController.
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $charges = $student->feeCharges()->with(['fee', 'payments.recordedBy'])->orderByDesc('id')->get();

        return response()->json([
            'summary' => (array) StudentFeesSummaryType::fromCharges($charges),
            'fee_charges' => $charges->map(fn ($charge) => FeeChargeType::fromModel($charge))->values()->all(),
        ]);
    }

    private function student(Request $request): Student
    {
        $student = Student::where('parent_user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
