<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\TypeScript\PublicPlanType;
use Illuminate\Http\JsonResponse;

/**
 * The plans for the landing page's pricing section (docs/design-refresh-plan.md,
 * step 3). Public: limits and modules only, no school counts. There are no
 * prices yet, since billing is out of scope (docs/central-dashboard-plan.md).
 */
class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'plans' => Plan::orderByRaw('max_students is null, max_students')->get()
                ->map(fn (Plan $plan) => PublicPlanType::fromModel($plan))
                ->all(),
            'contact_email' => config('schools.contact_email'),
        ]);
    }
}
