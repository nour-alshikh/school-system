<?php

namespace App\Http\Controllers\Platform;

use App\Enums\AnnouncementLevel;
use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The system admin writes, edits and ends announcements
 * (docs/central-dashboard-plan.md, phase 8). Every change is audited.
 */
class AnnouncementController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'announcements' => Announcement::with(['school:id,name', 'creator:id,name'])
                ->withCount('dismissedBy as dismissals_count')
                ->latest('starts_at')
                ->take(100)
                ->get()
                ->map(fn (Announcement $a) => $this->payload($a))
                ->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $announcement = Announcement::create([...$this->validated($request), 'created_by' => $request->user()->id]);

        AuditLog::record('announcement.created', $announcement, ['title' => $announcement->getTranslation('title', 'en')], $announcement->school);

        return response()->json(['announcement' => $this->payload($announcement->load(['school:id,name', 'creator:id,name']))], 201);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $announcement->update($this->validated($request));

        AuditLog::record('announcement.updated', $announcement, ['title' => $announcement->getTranslation('title', 'en')], $announcement->school);

        return response()->json(['announcement' => $this->payload($announcement->load(['school:id,name', 'creator:id,name']))]);
    }

    /** Takes it down now. */
    public function end(Announcement $announcement): JsonResponse
    {
        $announcement->update(['ends_at' => now()]);

        AuditLog::record('announcement.ended', $announcement, ['title' => $announcement->getTranslation('title', 'en')], $announcement->school);

        return response()->json(['announcement' => $this->payload($announcement->load(['school:id,name', 'creator:id,name']))]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title.en' => ['required', 'string', 'max:200'],
            'title.ar' => ['required', 'string', 'max:200'],
            'body.en' => ['nullable', 'string', 'max:2000'],
            'body.ar' => ['nullable', 'string', 'max:2000'],
            'level' => ['required', Rule::enum(AnnouncementLevel::class)],
            'school_id' => ['nullable', 'integer', 'exists:schools,id'],
            'audience' => ['nullable', 'array', 'min:1'],
            'audience.*' => [Rule::enum(MembershipRole::class)],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        return [
            'title' => $data['title'],
            'body' => array_filter($data['body'] ?? []) ?: null,
            'level' => $data['level'],
            'school_id' => $data['school_id'] ?? null,
            'audience' => isset($data['audience']) ? array_values(array_unique($data['audience'])) : null,
            'starts_at' => $data['starts_at'] ?? now(),
            'ends_at' => $data['ends_at'] ?? null,
        ];
    }

    private function payload(Announcement $a): array
    {
        return [
            'id' => $a->id,
            'title' => $a->getTranslations('title'),
            'body' => $a->getTranslations('body'),
            'level' => $a->level->value,
            'school' => $a->school?->only(['id', 'name']),
            'audience' => $a->audience,
            'starts_at' => $a->starts_at->toJSON(),
            'ends_at' => $a->ends_at?->toJSON(),
            'active' => $a->starts_at->isPast() && ($a->ends_at === null || $a->ends_at->isFuture()),
            'created_by' => $a->creator?->name,
            'dismissals_count' => (int) ($a->dismissals_count ?? 0),
        ];
    }
}
