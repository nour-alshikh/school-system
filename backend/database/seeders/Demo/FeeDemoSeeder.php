<?php

namespace Database\Seeders\Demo;

use App\Enums\FeeChargeStatus;
use App\Enums\StudentStatus;
use App\Models\AcademicYear;
use App\Models\Fee;
use App\Models\FeeCharge;
use App\Models\FeePayment;
use App\Models\Grade;
use App\Models\Stage;
use App\Models\Student;
use App\Models\User;

/**
 * The current school's fees for this year, a charge per student per fee
 * that applies to them, and a mix of payments so every status shows up.
 * Amounts are in the school's currency.
 */
class FeeDemoSeeder
{
    /**
     * @param  array{tuition: int, books: int, bus: int}  $amounts
     */
    public function run(User $admin, array $amounts): void
    {
        $year = AcademicYear::where('is_current', true)->firstOrFail();

        $fees = collect([
            Fee::create([
                'name' => ['en' => 'Tuition', 'ar' => 'المصروفات الدراسية'],
                'academic_year_id' => $year->id, 'amount' => $amounts['tuition'], 'is_active' => true, 'is_for_all' => true,
            ]),
        ]);

        // Books: one fee per stage.
        foreach (Stage::orderBy('id')->get() as $stage) {
            $fees->push(Fee::create([
                'name' => ['en' => 'Books — '.$stage->getTranslation('name', 'en'), 'ar' => 'الكتب — '.$stage->getTranslation('name', 'ar')],
                'academic_year_id' => $year->id, 'amount' => $amounts['books'], 'is_active' => true, 'is_for_all' => false,
                'stage_id' => $stage->id,
            ]));
        }

        // Bus: only the first two grades.
        foreach (Grade::orderBy('id')->take(2)->get() as $grade) {
            $fees->push(Fee::create([
                'name' => ['en' => 'Bus — '.$grade->getTranslation('name', 'en'), 'ar' => 'الحافلة — '.$grade->getTranslation('name', 'ar')],
                'academic_year_id' => $year->id, 'amount' => $amounts['bus'], 'is_active' => true, 'is_for_all' => false,
                'stage_id' => $grade->stage_id, 'grade_id' => $grade->id,
            ]));
        }

        $students = Student::where('status', StudentStatus::Active)->where('academic_year_id', $year->id)->orderBy('id')->get();

        foreach ($students as $student) {
            $applicable = $fees->filter(fn (Fee $fee) => $fee->is_for_all
                || ($fee->grade_id === null && $fee->stage_id === $student->stage_id)
                || $fee->grade_id === $student->grade_id);

            foreach ($applicable as $fee) {
                $charge = FeeCharge::create([
                    'student_id' => $student->id,
                    'fee_id' => $fee->id,
                    'academic_year_id' => $year->id,
                    'amount_due' => $fee->amount,
                    'status' => FeeChargeStatus::Unpaid,
                ]);

                $this->settle($charge, $admin);
            }
        }
    }

    /**
     * ~50% paid (one or two payments), ~25% partial, ~20% unpaid, ~5%
     * waived. Status comes from the payments, as when a payment is
     * recorded in the app (FeeCharge::recomputeStatus()).
     */
    private function settle(FeeCharge $charge, User $admin): void
    {
        $roll = fake()->numberBetween(1, 100);
        $due = (float) $charge->amount_due;

        if ($roll > 95) {
            $charge->update(['status' => FeeChargeStatus::Waived]);

            return;
        }

        $payments = match (true) {
            $roll <= 25 => [$due],
            $roll <= 50 => [round($due * 0.5, 2), $due - round($due * 0.5, 2)],
            $roll <= 75 => [round($due * fake()->numberBetween(40, 70) / 100, 2)],
            default => [],
        };

        foreach ($payments as $amount) {
            FeePayment::create([
                'fee_charge_id' => $charge->id,
                'amount' => $amount,
                'paid_at' => now()->subDays(fake()->numberBetween(1, 60))->toDateString(),
                'method' => fake()->randomElement(['cash', 'bank_transfer', 'card']),
                'recorded_by_id' => $admin->id,
            ]);
        }

        $charge->recomputeStatus();
    }
}
