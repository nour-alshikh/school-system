<?php

return [

    /*
    | Slugs a school can never take: they collide with the app's own paths
    | or would read as official. See docs/self-service-schools-plan.md.
    */
    'reserved_slugs' => [
        'admin', 'api', 'app', 'assets', 'auth', 'create-school', 'dashboard',
        'demo', 'help', 'login', 'logout', 'mail', 'platform', 'register',
        'root', 'school', 'schools', 'static', 'support', 'system', 'test', 'www',
    ],

    /*
    | Currencies a school's admin can pick (ISO 4217). The frontend formats
    | amounts with Intl.NumberFormat, so any code works there; this list just
    | keeps the picker short and the value valid.
    */
    'currencies' => [
        'EGP', 'SAR', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'IQD', 'LBP',
        'SYP', 'YER', 'LYD', 'TND', 'DZD', 'MAD', 'SDG', 'USD', 'EUR', 'GBP',
        'TRY',
    ],

    /*
    | The plan a self-service school starts on (docs/central-dashboard-plan.md,
    | phase 9). A system admin can change it from the school's Manage tab.
    */
    'self_service_plan' => env('SCHOOLS_SELF_SERVICE_PLAN', 'basic'),

    /*
    | How many schools one account can create through self-service. Platform
    | admins aren't limited. Counted by schools.created_by_id.
    */
    'max_self_service_per_user' => (int) env('SCHOOLS_MAX_SELF_SERVICE_PER_USER', 3),

];
