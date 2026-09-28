<?php

namespace App\Enums;

enum MembershipStatus: string
{
    case Invited = 'invited';
    case Active = 'active';
    case Suspended = 'suspended';
    // Transferred or left — the row is kept so history still points at it.
    case Left = 'left';
}
