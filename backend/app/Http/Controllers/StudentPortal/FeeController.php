<?php

namespace App\Http\Controllers\StudentPortal;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\TypeScript\FeeChargeType;
use App\TypeScript\StudentFeesSummaryType;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FeeController extends Controller
{
    /**
     * This student's full fee charge ledger — the dashboard only shows the
     * due/paid/outstanding totals, this is what its "view fees" link leads
     * to.
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
        $student = Student::where('user_id', $request->user()->id)->first();
        abort_if(! $student, Response::HTTP_FORBIDDEN);

        return $student;
    }
}
