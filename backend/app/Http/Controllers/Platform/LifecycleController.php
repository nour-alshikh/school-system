<?php

namespace App\Http\Controllers\Platform;

use App\Enums\SchoolStatus;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\School;
use App\Models\SchoolExport;
use App\Platform\SchoolLifecycle;
use App\Rules\SchoolSlug;
use App\TypeScript\PlatformSchoolType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Editing, suspending, archiving and exporting a school
 * (docs/central-dashboard-plan.md, phase 7). Purging is CLI only.
 */
class LifecycleController extends Controller
{
    public function __construct(private readonly SchoolLifecycle $lifecycle) {}

    public function update(Request $request, School $school): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            // Its own slug is fine; SchoolSlug would call it taken.
            'slug' => ['sometimes', 'required', 'string', Rule::when($request->input('slug') !== $school->slug, [new SchoolSlug])],
            'settings' => ['sometimes', 'array'],
            'settings.primary_color' => ['nullable', 'string', 'max:20'],
            'settings.email' => ['nullable', 'email', 'max:255'],
            'settings.phone' => ['nullable', 'string', 'max:50'],
            'settings.address' => ['nullable', 'string', 'max:500'],
        ]);

        $this->lifecycle->update($school, $data);

        return response()->json(['school' => PlatformSchoolType::fromModel($school->fresh())]);
    }

    /** A reason is required to suspend or archive: the school's members see it at sign-in. */
    public function status(Request $request, School $school): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::enum(SchoolStatus::class)],
            'reason' => ['nullable', 'required_unless:status,active', 'string', 'max:500'],
        ], ['reason.required_unless' => __('validation.school_status_reason')]);

        $this->lifecycle->setStatus($school, SchoolStatus::from($data['status']), $data['reason'] ?? null);

        return response()->json(['school' => PlatformSchoolType::fromModel($school->fresh())]);
    }

    public function export(Request $request, School $school): JsonResponse
    {
        $export = $this->lifecycle->export($school, $request->user());

        return response()->json(['export' => $this->exportPayload($export)], 201);
    }

    public function exports(School $school): JsonResponse
    {
        return response()->json([
            'exports' => SchoolExport::with('creator:id,name')
                ->where('school_id', $school->id)
                ->latest('id')
                ->take(10)
                ->get()
                ->map(fn (SchoolExport $e) => $this->exportPayload($e))
                ->all(),
        ]);
    }

    /** Only while the link is valid (24 hours). Audited. */
    public function download(SchoolExport $export): BinaryFileResponse
    {
        abort_if($export->expires_at->isPast() || ! Storage::disk('local')->exists($export->path), 410, __('api.export_expired'));

        AuditLog::record('school.export_downloaded', $export, school: School::find($export->school_id));

        return response()->download(Storage::disk('local')->path($export->path), basename($export->path), [
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function exportPayload(SchoolExport $export): array
    {
        return [
            'id' => $export->id,
            'size' => $export->size,
            'created_at' => $export->created_at->toJSON(),
            'expires_at' => $export->expires_at->toJSON(),
            'expired' => $export->expires_at->isPast(),
            'created_by' => $export->creator?->name,
        ];
    }
}
