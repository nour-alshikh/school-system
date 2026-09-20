<?php

namespace App\Http\Requests\FeeCharge;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFeeChargeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'fee_id' => [
                'required',
                'integer',
                'exists:fees,id',
                Rule::unique('fee_charges')->where('student_id', $this->route('student')->id),
            ],
            'amount_due' => ['required', 'numeric', 'min:0'],
        ];
    }
}
