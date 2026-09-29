<?php

namespace App\Http\Controllers\ParentPortal;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\Student;
use App\Services\ParentChildren;
use App\TypeScript\FeeChargeType;
use App\TypeScript\StudentFeesSummaryType;
use Illuminate\Http\Request;

class FeeController extends Controller
{
    /**
     * One of this parent's children's full fee charge ledger — read-only, same shape
     * as StudentPortal\FeeController.
     */
    public function index(Request $request)
    {
        $student = $this->student($request);

        $charges = $student->feeCharges()->with(['fee', 'payments.recordedBy'])->orderByDesc('id')->get();

        return response()->json([
            'summary' => (array) StudentFeesSummaryType::fromCharges($charges),
            'fee_charges' => $charges->map(fn ($charge) => FeeChargeType::fromModel($charge))->values()->all(),
            // The child's school's (student() switched to it), which may
            // not be the school the parent is signed in to.
            'currency' => Setting::currency(),
        ]);
    }

    /** ?student_id picks the child (any of theirs, at any of their schools). */
    private function student(Request $request): Student
    {
        return app(ParentChildren::class)->resolve($request->user(), $request->integer('student_id') ?: null);
    }
}
