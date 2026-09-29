<?php

namespace App\Http\Controllers\Platform;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\School;
use App\Platform\AuditLogResource;
use App\Platform\SchoolMetrics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The central dashboard's monitoring pages (docs/central-dashboard-plan.md,
 * phases 2 and 4). Platform token only (platform-admin middleware).
 */
class DashboardController extends Controller
{
    public function __construct(private readonly SchoolMetrics $metrics) {}

    /** Totals and the schools table. ?refresh=1 skips the 10-minute cache. */
    public function overview(Request $request): JsonResponse
    {
        return response()->json($this->metrics->overview($request->boolean('refresh')));
    }

    public function school(School $school): JsonResponse
    {
        return response()->json($this->metrics->school($school));
    }

    /** Every audit entry, newest first, filterable. */
    public function auditLogs(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'school_id' => ['nullable', 'integer'],
            'actor_id' => ['nullable', 'integer'],
            'action' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $logs = AuditLog::with(['actor:id,name,email', 'school:id,name,slug'])
            ->when($filters['school_id'] ?? null, fn ($q, $id) => $q->where('school_id', $id))
            ->when($filters['actor_id'] ?? null, fn ($q, $id) => $q->where('actor_id', $id))
            ->when($filters['action'] ?? null, fn ($q, $action) => $q->where('action', 'like', addcslashes($action, '%_\\').'%'))
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<', now()->parse($to)->addDay()))
            ->latest('id')
            ->paginate(50);

        return response()->json([
            'audit_logs' => collect($logs->items())->map(fn (AuditLog $log) => AuditLogResource::from($log))->all(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
