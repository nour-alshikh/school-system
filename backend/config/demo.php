<?php

/*
 * Public demo deployment (docs/demo-sandboxes.md). With DEMO_MODE on, every
 * visitor gets a private copy of the demo data: an SQLite file copied from
 * a template, plus a copy of its uploaded files, picked by the
 * X-Demo-Sandbox header the BFF sends. Copies are deleted once idle.
 */
return [

    'enabled' => (bool) env('DEMO_MODE', false),

    // Built by `php artisan demo:build`; every sandbox starts as a copy.
    'template_path' => storage_path('app/demo/template.sqlite'),
    'template_files' => storage_path('app/demo/template-files'),

    // One {id}.sqlite per visitor.
    'sandboxes_path' => storage_path('app/demo/sandboxes'),

    // A sandbox nobody has used for this long is deleted (and a visitor
    // coming back gets a fresh copy).
    'idle_minutes' => (int) env('DEMO_IDLE_MINUTES', 180),

    // At most this many at once: past it, the longest-idle ones go first.
    'max_sandboxes' => (int) env('DEMO_MAX_SANDBOXES', 200),

    // AI calls per day across every sandbox together. Each sandbox counts
    // its own usage from scratch, so the per-user and per-school caps
    // can't hold the total down. Null: no cap.
    'ai_daily_cap' => env('DEMO_AI_DAILY_CAP', 150),

];
