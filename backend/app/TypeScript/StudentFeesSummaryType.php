<?php

namespace App\TypeScript;

use Illuminate\Support\Collection;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class StudentFeesSummaryType
{
    public function __construct(
        public readonly string $total_due,
        public readonly string $total_paid,
        public readonly string $total_outstanding,
    ) {}

    /**
     * @param  Collection<int, \App\Models\FeeCharge>  $charges
     */
    public static function fromCharges(Collection $charges): self
    {
        $totalDue = $charges->sum(fn ($charge) => (float) $charge->amount_due);
        $totalPaid = $charges->sum(fn ($charge) => (float) $charge->amountPaid());

        return new self(
            total_due: number_format($totalDue, 2, '.', ''),
            total_paid: number_format($totalPaid, 2, '.', ''),
            total_outstanding: number_format($totalDue - $totalPaid, 2, '.', ''),
        );
    }
}
