<?php

namespace App\Http\Requests\FeeCharge;

use App\Enums\FeePaymentMethod;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreFeePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Negative amounts are allowed here (a refund/correction entry),
            // just not zero.
            'amount' => ['required', 'numeric', 'not_in:0'],
            'paid_at' => ['required', 'date'],
            'method' => ['required', new Enum(FeePaymentMethod::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * The running total (existing payments + this one) must stay within
     * [0, amount_due] — no overpaying a charge, and no refunding more than
     * has actually been paid on it.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($validator->errors()->has('amount')) {
                return;
            }

            $feeCharge = $this->route('feeCharge');
            $newTotal = (float) $feeCharge->amountPaid() + (float) $this->input('amount');

            if ($newTotal > (float) $feeCharge->amount_due) {
                $remaining = number_format((float) $feeCharge->amount_due - (float) $feeCharge->amountPaid(), 2);
                $validator->errors()->add('amount', "This payment exceeds the remaining balance of {$remaining}.");
            } elseif ($newTotal < 0) {
                $validator->errors()->add('amount', 'This refund exceeds the amount already paid on this charge.');
            }
        });
    }
}
