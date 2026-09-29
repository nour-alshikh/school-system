<?php

namespace App\Enums;

enum SchoolStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    // Soft-deleted: like suspended, hidden from lists by default, and
    // reversible for 30 days before it may be purged (docs/central-dashboard-plan.md, phase 7).
    case Archived = 'archived';
}
