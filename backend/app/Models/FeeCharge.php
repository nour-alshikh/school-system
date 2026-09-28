<?php

namespace App\Models;

use App\Enums\FeeChargeStatus;
use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FeeCharge extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'student_id',
        'fee_id',
        'academic_year_id',
        'amount_due',
        'status',
    ];

    protected $casts = [
        'amount_due' => 'decimal:2',
        'status' => FeeChargeStatus::class,
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function fee(): BelongsTo
    {
        return $this->belongsTo(Fee::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(FeePayment::class);
    }

    /**
     * Always queried fresh (never the cached `payments` relation, which may
     * be stale or unloaded) so this is safe to call right after inserting a
     * new payment in the same request.
     */
    public function amountPaid(): string
    {
        return (string) $this->payments()->sum('amount');
    }

    /**
     * Recomputes status from the payment ledger — the source of truth is
     * always sum(payments), never a value written directly onto the charge
     * (other than the explicit Waived override, which this leaves alone).
     */
    public function recomputeStatus(): void
    {
        if ($this->status === FeeChargeStatus::Waived) {
            return;
        }

        $paid = (float) $this->amountPaid();

        $this->status = match (true) {
            $paid <= 0 => FeeChargeStatus::Unpaid,
            $paid < (float) $this->amount_due => FeeChargeStatus::Partial,
            default => FeeChargeStatus::Paid,
        };

        $this->save();
    }
}
