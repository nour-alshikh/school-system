<?php

namespace App\Http\Requests\FeeCharge;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Bulk create — the form lets a registrar charge several fees to a student
 * in one submit, so this validates a `charges` array rather than a single
 * record. See StoreClassroomRequest for the same convention.
 */
class StoreFeeChargeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'charges' => ['required', 'array', 'min:1'],
            'charges.*.fee_id' => ['required', 'integer', 'exists:fees,id'],
            'charges.*.amount_due' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Two checks per row: no fee charged twice within this same submission,
     * and no fee that's already been charged to this student from an
     * earlier request (the unique index on fee_charges catches this too,
     * but this gives a field-level error instead of a raw DB failure).
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $student = $this->route('student');
            $seenFeeIds = [];

            foreach ($this->input('charges', []) as $index => $charge) {
                $feeId = $charge['fee_id'] ?? null;
                if ($feeId === null) {
                    continue;
                }

                if (in_array($feeId, $seenFeeIds, true)) {
                    $validator->errors()->add(
                        "charges.$index.fee_id",
                        'Each fee can only be charged once per submission.'
                    );
                }
                $seenFeeIds[] = $feeId;

                $alreadyCharged = $student->feeCharges()->where('fee_id', $feeId)->exists();

                if ($alreadyCharged) {
                    $validator->errors()->add(
                        "charges.$index.fee_id",
                        'This fee has already been charged to this student.'
                    );
                }
            }
        });
    }
}
