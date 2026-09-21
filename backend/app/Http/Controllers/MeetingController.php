<?php

namespace App\Http\Controllers;

use App\Http\Requests\Meeting\StoreMeetingRequest;
use App\Http\Resources\ClassroomResource;
use App\Http\Resources\MeetingResource;
use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\Meeting;
use App\Services\ZoomService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class MeetingController extends Controller
{
    public function __construct(private readonly ZoomService $zoom) {}

    /**
     * Which classrooms the current user may schedule a meeting for — same
     * "admin gets everything, teacher gets only classrooms they hold a
     * subject slot in" split as AttendanceController::classrooms().
     */
    public function classrooms(Request $request)
    {
        $user = $request->user();
        $query = Classroom::with('grade')->orderBy('id');

        if (! $user->can('manage-meetings')) {
            $teacher = $user->teacher;
            abort_if(! $teacher, Response::HTTP_FORBIDDEN);

            $query->whereIn('id', $teacher->classroomSubjects()->pluck('classroom_id'));
        }

        return response()->json(['classrooms' => ClassroomResource::collection($query->get())]);
    }

    /**
     * Admin (manage-meetings) sees every meeting; a teacher only sees the
     * ones they created — same "own scope" convention as ExamController.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Meeting::with(['classrooms', 'creator'])->orderByDesc('start_time');

        if (! $user->can('manage-meetings')) {
            $query->where('created_by', $user->id);
        }

        return response()->json(['meetings' => MeetingResource::collection($query->get())]);
    }

    public function store(StoreMeetingRequest $request)
    {
        $data = $request->validated();
        $this->authorizeClassrooms($request, $data['classroom_ids']);

        $zoomMeeting = $this->zoom->createMeeting(
            topic: $data['title'],
            agenda: $data['description'] ?? null,
            startTime: Carbon::parse($data['start_time']),
            durationMinutes: $data['duration_minutes'],
        );

        $meeting = DB::transaction(function () use ($data, $request, $zoomMeeting) {
            $meeting = Meeting::create([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'start_time' => $data['start_time'],
                'duration_minutes' => $data['duration_minutes'],
                'academic_year_id' => $this->currentAcademicYearId(),
                'created_by' => $request->user()->id,
                ...$zoomMeeting,
            ]);

            $meeting->classrooms()->attach($data['classroom_ids']);

            return $meeting;
        });

        return response()->json(['meeting' => new MeetingResource($meeting->load(['classrooms', 'creator']))], 201);
    }

    /**
     * Cancels on both sides — the Zoom meeting is deleted (best-effort, see
     * ZoomService::deleteMeeting) and the local record with it, so it stops
     * showing up on every assigned student's meeting list.
     */
    public function destroy(Request $request, Meeting $meeting)
    {
        $this->authorizeManage($request, $meeting);

        $this->zoom->deleteMeeting($meeting->zoom_meeting_id);
        $meeting->delete();

        return response()->noContent();
    }

    private function currentAcademicYearId(): int
    {
        return AcademicYear::where('is_current', true)->firstOrFail()->id;
    }

    /**
     * A teacher may only target classrooms they hold a subject slot in —
     * same idea as ExamController::authorizeTarget(), just over a set of
     * classrooms instead of one classroom+subject pair.
     */
    private function authorizeClassrooms(Request $request, array $classroomIds): void
    {
        $user = $request->user();

        if ($user->can('manage-meetings')) {
            return;
        }

        $teacher = $user->teacher;
        abort_if(! $teacher, Response::HTTP_FORBIDDEN);

        $allowed = $teacher->classroomSubjects()->pluck('classroom_id')->unique();
        abort_if(collect($classroomIds)->diff($allowed)->isNotEmpty(), Response::HTTP_FORBIDDEN);
    }

    private function authorizeManage(Request $request, Meeting $meeting): void
    {
        $user = $request->user();

        if ($user->can('manage-meetings')) {
            return;
        }

        abort_if($meeting->created_by !== $user->id, Response::HTTP_FORBIDDEN);
    }
}
