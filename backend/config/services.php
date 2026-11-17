<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // A regular (user) OAuth app, not Server-to-Server — that app type
    // needs a paid Zoom plan, which this project can't assume. One admin
    // authorizes it once (see ZoomController/ZoomService); the resulting
    // token pair is stored in zoom_connections and reused for everyone.
    'zoom' => [
        'client_id' => env('ZOOM_CLIENT_ID'),
        'client_secret' => env('ZOOM_CLIENT_SECRET'),
        'redirect_uri' => env('ZOOM_REDIRECT_URI'),
    ],

    // The Next.js BFF passes the visitor's address in X-Client-IP, proven by
    // this shared secret (App\Http\Middleware\TrustBffClientIp). Same value
    // as BFF_SHARED_SECRET in the frontend's environment. Empty: ignored.
    'bff' => [
        'secret' => env('BFF_SHARED_SECRET'),
    ],

    // AI features (docs/ai-assistant-plan.md, App\Services\Ai\AiClient). No
    // key: AI buttons hide, and "Describe your school" uses the standard structure.
    'openrouter' => [
        'key' => env('OPENROUTER_API_KEY'),
        'model' => env('OPENROUTER_MODEL', 'nvidia/nemotron-3-ultra-550b-a55b:free'),
        // Any OpenAI-compatible chat completions API; changed for local testing.
        'url' => env('OPENROUTER_URL', 'https://openrouter.ai/api/v1'),
    ],

];
