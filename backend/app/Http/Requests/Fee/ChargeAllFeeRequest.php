<?php

namespace App\Http\Requests\Fee;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * The "charge all matching students" review step submits its (possibly
 * edited/trimmed) student list back as a `charges` array — same bulk
 * convention as StoreFeeChargeRequest, just keyed by student_id instead of
 * fee_id since the fee is fixed by the route.
 */
class ChargeAllFeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'charges' => ['required', 'array', 'min:1'],
            'charges.*.student_id' => ['required', 'integer', 'exists:students,id'],
            'charges.*.amount_due' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Same two checks as StoreFeeChargeRequest, mirrored for student_id
     * instead of fee_id: no student charged twice in this submission, and
     * no student who already has a charge for this fee from an earlier
     * request.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $fee = $this->route('fee');
            $seenStudentIds = [];

            foreach ($this->input('charges', []) as $index => $charge) {
                $studentId = $charge['student_id'] ?? null;
                if ($studentId === null) {
                    continue;
                }

                if (in_array($studentId, $seenStudentIds, true)) {
                    $validator->errors()->add(
                        "charges.$index.student_id",
                        'Each student can only be charged once per submission.'
                    );
                }
                $seenStudentIds[] = $studentId;

                $alreadyCharged = $fee->charges()->where('student_id', $studentId)->exists();

                if ($alreadyCharged) {
                    $validator->errors()->add(
                        "charges.$index.student_id",
                        'This student has already been charged this fee.'
                    );
                }
            }
        });
    }
}
