<?php

namespace App\Models;

use App\Enums\FeePaymentMethod;
use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeePayment extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'fee_charge_id',
        'amount',
        'paid_at',
        'method',
        'note',
        'recorded_by_id',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'date',
        'method' => FeePaymentMethod::class,
    ];

    public function feeCharge(): BelongsTo
    {
        return $this->belongsTo(FeeCharge::class);
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by_id');
    }
}
