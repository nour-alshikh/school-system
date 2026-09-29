<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Plan;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Plans and which school is on which (docs/central-dashboard-plan.md,
 * phase 9). Billing is out of scope.
 */
class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'plans' => Plan::withCount('schools')->orderByRaw('max_students is null, max_students')->get()
                ->map(fn (Plan $p) => $this->payload($p))
                ->all(),
            'features' => Plan::FEATURES,
        ]);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'max_students' => ['nullable', 'integer', 'min:1'],
            'max_storage_mb' => ['nullable', 'integer', 'min:1'],
            'features' => ['present', 'array'],
            'features.*' => [Rule::in(Plan::FEATURES)],
        ]);

        $before = $plan->only(['name', 'max_students', 'max_storage_mb', 'features']);
        $plan->update([...$data, 'features' => array_values(array_unique($data['features']))]);

        AuditLog::record('plan.updated', $plan, ['before' => $before, 'after' => $plan->only(array_keys($before))], platformWide: true);

        return response()->json(['plan' => $this->payload($plan->loadCount('schools'))]);
    }

    /** Moves a school to another plan. Already over its new limits: nothing is removed, new additions are refused. */
    public function assign(Request $request, School $school): JsonResponse
    {
        $data = $request->validate(['plan_id' => ['required', 'integer', 'exists:plans,id']]);
        $from = $school->plan?->name;

        $school->update(['plan_id' => $data['plan_id']]);

        AuditLog::record('school.plan_changed', $school, ['from' => $from, 'to' => $school->fresh()->plan->name]);

        return response()->json(['plan' => $this->payload($school->plan()->withCount('schools')->first())]);
    }

    private function payload(Plan $plan): array
    {
        return [
            'id' => $plan->id,
            'key' => $plan->key,
            'name' => $plan->name,
            'max_students' => $plan->max_students,
            'max_storage_mb' => $plan->max_storage_mb,
            'features' => $plan->features,
            'schools_count' => (int) ($plan->schools_count ?? 0),
        ];
    }
}
