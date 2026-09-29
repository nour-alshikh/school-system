<?php

namespace App\Enums;

enum AnnouncementLevel: string
{
    case Info = 'info';
    case Warning = 'warning';
    // Can't be dismissed.
    case Critical = 'critical';
}
