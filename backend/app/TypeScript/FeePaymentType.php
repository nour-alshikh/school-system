<?php

namespace App\TypeScript;

use App\Enums\FeePaymentMethod;
use App\Models\FeePayment;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
final class FeePaymentType
{
    public function __construct(
        public readonly int $id,
        public readonly string $amount,
        public readonly string $paid_at,
        public readonly FeePaymentMethod $method,
        public readonly ?string $note,
        public readonly ?string $recorded_by_name,
        public readonly string $created_at,
    ) {}

    public static function fromModel(FeePayment $payment): self
    {
        return new self(
            id: $payment->id,
            amount: (string) $payment->amount,
            paid_at: $payment->paid_at->toDateString(),
            method: $payment->method,
            note: $payment->note,
            recorded_by_name: $payment->recordedBy?->name,
            created_at: $payment->created_at->toJSON(),
        );
    }
}
