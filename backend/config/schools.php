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

];
