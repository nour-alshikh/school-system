<?php

namespace App\Http\Requests\FeeCharge;

use App\Enums\FeePaymentMethod;
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
}
