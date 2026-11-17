<?php

use App\Services\Ai\Assistant\Tools;
use App\Services\Ai\Drafts\CalendarEventDrafter;
use App\Services\Ai\Drafts\ExamQuestionsDrafter;
use App\Services\Ai\Drafts\LibraryResourceDrafter;
use App\Services\Ai\Drafts\MeetingDrafter;
use App\Services\Ai\Drafts\TranslateDrafter;

/*
 * AI features (docs/ai-assistant-plan.md). The provider, key and model stay
 * in services.openrouter; this is what the app does with them.
 */
return [

    // Master switch: false hides every AI button, as if no key were set.
    'enabled' => env('AI_ENABLED', true),

    // Calls per day (app time zone), counted from ai_usage, failed calls included:
    // they cost too. Null: no cap.
    'caps' => [
        'user_daily' => env('AI_USER_DAILY_CAP', 50),
        'school_daily' => env('AI_SCHOOL_DAILY_CAP', 300),
        // "Describe your school" on the landing page, across all visitors.
        // Past it, visitors get the standard structure instead.
        'blueprint_daily' => env('AI_BLUEPRINT_DAILY_CAP', 200),
    ],

    // Draft kinds served by POST /api/ai/draft/{kind}: kind => Drafter class
    // (phase 3). Each checks its own permission and plan module. The
    // platform announcement drafter isn't here: it has its own system admin
    // route, and so does "Describe your school" (public).
    'drafts' => [
        'exam_questions' => ExamQuestionsDrafter::class,
        'translate' => TranslateDrafter::class,
        'calendar_event' => CalendarEventDrafter::class,
        'meeting' => MeetingDrafter::class,
        'library_resource' => LibraryResourceDrafter::class,
    ],

    // The assistant's read-only lookups (phase 5), offered only when the
    // school turned on assistant_data, and each only to whoever may use it.
    'assistant_tools' => [
        Tools\AttendanceSummary::class,
        Tools\LowAttendanceStudents::class,
        Tools\FeesOverview::class,
        Tools\OverdueStudents::class,
        Tools\ExamResults::class,
        Tools\FindStudent::class,
        Tools\Upcoming::class,
        Tools\MySummary::class,
        Tools\MyChildSummary::class,
    ],

];
