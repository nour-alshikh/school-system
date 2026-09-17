<?php

namespace App\Http\Requests\Promotion;

use Illuminate\Foundation\Http\FormRequest;

class RollbackPromotionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'promotion_ids' => ['required', 'array', 'min:1'],
            'promotion_ids.*' => ['integer', 'exists:promotions,id'],
        ];
    }
}
