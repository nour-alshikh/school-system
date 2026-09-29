<?php

namespace App\Enums;

enum SchoolSource: string
{
    case Platform = 'platform';
    case SelfService = 'self_service';
    case Seed = 'seed';
}
