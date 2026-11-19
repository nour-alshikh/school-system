<?php

return [

    /*
    | Two-factor for system admins (docs/central-dashboard-plan.md, phase 1):
    | a code from an authenticator app at sign-in, and again before opening
    | a school. On unless PLATFORM_TWO_FACTOR=false. Keep it on for any real
    | deployment; turning it off (local development) signs system admins in
    | with email and password only. A public demo (DEMO_MODE) defaults to off:
    | visitors sign in with the published demo account, and each has their
    | own copy of the data (docs/demo-sandboxes.md).
    */
    'two_factor' => (bool) env('PLATFORM_TWO_FACTOR', ! env('DEMO_MODE', false)),

];
