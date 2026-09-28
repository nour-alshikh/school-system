<?php

namespace App\Enums;

/**
 * A user's role *at one school*. Mirrors the spatie role names that are
 * school-scoped — the base 'user' role is deliberately absent, since a
 * plain account belongs to no school. See docs/multi-tenancy.md.
 */
enum MembershipRole: string
{
    case Admin = 'admin';
    case Teacher = 'teacher';
    case Parent = 'parent';
    case Student = 'student';
}
