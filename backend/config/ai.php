<?php

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
    ],

    // Draft kinds served by POST /api/ai/draft/{kind}: kind => Drafter class.
    // Added per form in phase 3. The platform announcement drafter isn't
    // here: it has its own system admin route.
    'drafts' => [
    ],

];
