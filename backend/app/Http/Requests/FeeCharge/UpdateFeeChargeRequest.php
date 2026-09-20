<?php

namespace App\Http\Requests\FeeCharge;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFeeChargeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount_due' => ['required', 'numeric', 'min:0'],
        ];
    }
}
