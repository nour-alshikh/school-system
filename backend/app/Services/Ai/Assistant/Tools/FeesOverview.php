<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Enums\FeeChargeStatus;
use App\Models\Fee;
use App\Models\FeeCharge;
use App\Models\FeePayment;
use App\Models\Setting;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Support\Collection;

/**
 * "How much is still owed this year?" — charged, collected and outstanding
 * totals, the same sums as the admin dashboard, plus the fees with the
 * most outstanding. manage-fees and the fees module only.
 */
class FeesOverview extends Tool
{
    public function name(): string
    {
        return 'fees_overview';
    }

    public function describe(): string
    {
        return 'fees_overview() — total charged, collected and outstanding, how many students owe, and the fees with the most still owed.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-fees') && $context->hasFeature('fees');
    }

    public function run(ToolContext $context, array $args): array
    {
        $charged = (float) FeeCharge::where('status', '!=', FeeChargeStatus::Waived)->sum('amount_due');
        $collected = (float) FeePayment::sum('amount');

        $open = FeeCharge::whereIn('status', [FeeChargeStatus::Unpaid, FeeChargeStatus::Partial])
            ->withSum('payments', 'amount')
            ->get(['id', 'fee_id', 'student_id', 'amount_due']);
        $owed = fn (FeeCharge $c) => max(0, (float) $c->amount_due - (float) $c->payments_sum_amount);

        $byFee = $open->groupBy('fee_id')->map(fn (Collection $charges) => $charges->sum($owed))->filter()->sortDesc()->take(5);
        $fees = Fee::whereIn('id', $byFee->keys())->get()->keyBy('id');

        return [
            'currency' => Setting::currency(),
            'source' => 'fee charges and recorded payments, all academic years',
            'charged' => Lookup::money($charged),
            'collected' => Lookup::money($collected),
            'outstanding' => Lookup::money(max(0, $charged - $collected)),
            'students_owing' => $open->groupBy('student_id')->filter(fn (Collection $charges) => $charges->sum($owed) > 0)->count(),
            'most_outstanding_fees' => $byFee
                ->map(fn (float $amount, int $feeId) => ['fee' => Lookup::name($fees->get($feeId)), 'outstanding' => Lookup::money($amount)])
                ->values()->all(),
            'links' => [['href' => '/fees', 'label' => 'Fees']],
        ];
    }
}
