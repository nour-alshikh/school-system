<?php

namespace App\Enums;

enum FeeChargeStatus: string
{
    case Unpaid = 'unpaid';
    case Partial = 'partial';
    case Paid = 'paid';
    case Waived = 'waived';
}
