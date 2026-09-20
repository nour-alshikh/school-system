<?php

namespace App\TypeScript;

use App\Enums\FeeChargeStatus;
use App\Models\FeeCharge;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class FeeChargeType
{
    public function __construct(
        public readonly int $id,
        public readonly int $student_id,
        public readonly int $fee_id,
        public readonly string $fee_name_en,
        public readonly string $fee_name_ar,
        public readonly int $academic_year_id,
        public readonly string $amount_due,
        public readonly string $amount_paid,
        public readonly FeeChargeStatus $status,
        /** @var FeePaymentType[] */
        public readonly array $payments,
        public readonly string $created_at,
    ) {}

    public static function fromModel(FeeCharge $charge): self
    {
        return new self(
            id: $charge->id,
            student_id: $charge->student_id,
            fee_id: $charge->fee_id,
            fee_name_en: $charge->fee->getTranslation('name', 'en'),
            fee_name_ar: $charge->fee->getTranslation('name', 'ar'),
            academic_year_id: $charge->academic_year_id,
            amount_due: (string) $charge->amount_due,
            amount_paid: $charge->amountPaid(),
            status: $charge->status,
            payments: $charge->payments
                ->sortByDesc('paid_at')
                ->map(fn ($payment) => FeePaymentType::fromModel($payment))
                ->values()
                ->all(),
            created_at: $charge->created_at->toJSON(),
        );
    }
}
