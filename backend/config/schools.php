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
    | How many schools one account can create through self-service. Platform
    | admins aren't limited. Counted by schools.created_by_id.
    */
    'max_self_service_per_user' => (int) env('SCHOOLS_MAX_SELF_SERVICE_PER_USER', 3),

];
