<?php

namespace App\Enums;

enum FeePaymentMethod: string
{
    case Cash = 'cash';
    case BankTransfer = 'bank_transfer';
    case Card = 'card';
    case Other = 'other';
}
