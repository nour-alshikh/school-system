<?php

namespace App\Http\Controllers;

use App\Enums\AnnouncementLevel;
use App\Http\Middleware\ResolveSchool;
use App\Models\Announcement;
use App\Models\PlatformSession;
use App\Models\SchoolMembership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Announcements for whoever is signed in: active now, for their school (or
 * every school) and their role there, minus the ones they dismissed
 * (docs/central-dashboard-plan.md, phase 8). Title and body come in the
 * request's language.
 */
class AnnouncementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        [$schoolId, $role] = $this->schoolAndRole($request);

        if ($schoolId === null) {
            return response()->json(['announcements' => []]);
        }

        $announcements = Announcement::active()
            ->for($schoolId, $role)
            ->where(fn ($q) => $q->where('level', AnnouncementLevel::Critical)
                ->orWhereDoesntHave('dismissedBy', fn ($d) => $d->where('users.id', $request->user()->id)))
            ->orderByRaw("case level when 'critical' then 0 when 'warning' then 1 else 2 end")
            ->latest('starts_at')
            ->get();

        return response()->json([
            'announcements' => $announcements->map(fn (Announcement $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'level' => $a->level->value,
                'dismissible' => $a->level !== AnnouncementLevel::Critical,
            ])->all(),
        ]);
    }

    /** Hidden for this user from now on. Critical ones can't be dismissed. */
    public function dismiss(Request $request, Announcement $announcement): Response
    {
        abort_if($announcement->level === AnnouncementLevel::Critical, 422, __('api.announcement_not_dismissible'));

        $announcement->dismissedBy()->syncWithoutDetaching([$request->user()->id]);

        return response()->noContent();
    }

    /**
     * The school and role this request is signed in as. A system admin
     * inside a school sees what its admins see; with no school (a platform
     * or plain session) there's nothing to show.
     *
     * @return array{0: int|null, 1: string|null}
     */
    private function schoolAndRole(Request $request): array
    {
        $membership = $request->attributes->get(ResolveSchool::MEMBERSHIP);
        if ($membership instanceof SchoolMembership) {
            return [$membership->school_id, $membership->role->value];
        }

        $session = $request->attributes->get(ResolveSchool::PLATFORM_SESSION);
        if ($session instanceof PlatformSession) {
            return [$session->school_id, 'admin'];
        }

        return [null, null];
    }
}
