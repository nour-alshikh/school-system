<?php

return [

    'unauthenticated' => 'Unauthenticated.',
    'unauthorized' => 'This action is unauthorized.',
    'not_found' => 'Resource not found.',
    'too_many_requests' => 'Too many requests.',
    'request_failed' => 'Request failed.',
    'server_error' => 'Server error.',
    'no_school' => 'This account isn\'t linked to a school.',
    'cannot_suspend_current_school' => 'You can\'t suspend the school you are signed in to. Switch to another school first.',
    'signup_rejected' => 'We couldn\'t create your school. Please try again.',
    'school_limit' => 'You\'ve reached the limit of :max schools you can create yourself. Contact support if you need more.',
    'structure_exists' => 'This school already has stages, so the standard structure wasn\'t added. Add what you need from each page instead.',
    'platform_confirm_required' => 'Enter a current code from your authenticator app to open this school.',
    'last_admin' => 'This is the school\'s last active admin. Add another admin first.',
    'archive_expired' => 'This school was archived more than :days days ago and can no longer be restored.',
    'export_expired' => 'This export link has expired. Create a new export.',
    'announcement_not_dismissible' => 'Critical announcements can’t be dismissed.',
    'ai_not_configured' => 'AI drafting isn’t set up. Add OPENROUTER_API_KEY to the backend .env.',
    'ai_draft_failed' => 'The AI couldn’t write a draft right now. Try again in a minute.',
    'ai_disabled' => 'AI features are turned off for this school. An admin can turn them on in Settings.',
    'ai_cap_reached_user' => 'You’ve used today’s AI drafts. Try again tomorrow.',
    'ai_cap_reached_school' => 'This school has used today’s AI drafts. Try again tomorrow.',
    'no_current_school' => 'Open a school first.',
    'blueprint_fallback' => 'We couldn’t read your description right now, so this is a standard structure. Change it below, or try describing it again later.',
    'blueprint_unchanged' => 'We couldn’t make that change right now, so your structure is as it was. Edit it below, or try again later.',
    'plan_student_limit' => 'Your plan allows :max students. Contact support to change plans.',
    'plan_storage_limit' => 'Your plan allows :max of files, and this would go over it. Remove some files or contact support to change plans.',
    'plan_feature_missing' => 'Not included in your plan.',
    'school_mismatch' => 'This request is for a different school than the one you are signed in to.',

];
