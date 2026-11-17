<?php

namespace App\Services\Ai\Assistant\Tools;

use App\Enums\FeeChargeStatus;
use App\Models\Classroom;
use App\Models\FeeCharge;
use App\Models\Setting;
use App\Models\Student;
use App\Services\Ai\Assistant\Lookup;
use App\Services\Ai\Assistant\Tool;
use App\Services\Ai\Assistant\ToolContext;
use Illuminate\Support\Collection;

/**
 * "Who still owes?" — students with an unpaid balance, most owed first,
 * optionally in one classroom. Same balance as the admin dashboard's
 * overdue list. manage-fees and the fees module only.
 */
class OverdueStudents extends Tool
{
    public function name(): string
    {
        return 'overdue_students';
    }

    public function describe(): string
    {
        return 'overdue_students(classroom?: string, limit?: number = 15) — students who still owe fees, most owed first, with the amount.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-fees') && $context->hasFeature('fees');
    }

    public function rules(): array
    {
        return [
            'classroom' => ['nullable', 'string', 'max:50'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function run(ToolContext $context, array $args): array
    {
        $limit = (int) ($args['limit'] ?? 15);

        $studentIds = null;
        if (filled($args['classroom'] ?? null)) {
            $classrooms = Lookup::matchClassrooms(Classroom::with('grade'), $args['classroom']);
            if ($classrooms->isEmpty()) {
                return ['error' => "No classroom matches \"{$args['classroom']}\"."];
            }
            $studentIds = Student::whereIn('classroom_id', $classrooms->pluck('id'))->pluck('id');
        }

        $balances = FeeCharge::whereIn('status', [FeeChargeStatus::Unpaid, FeeChargeStatus::Partial])
            ->when($studentIds !== null, fn ($q) => $q->whereIn('student_id', $studentIds))
            ->withSum('payments', 'amount')
            ->get(['id', 'student_id', 'amount_due'])
            ->groupBy('student_id')
            ->map(fn (Collection $charges) => $charges->sum(fn (FeeCharge $c) => max(0, (float) $c->amount_due - (float) $c->payments_sum_amount)))
            ->filter(fn (float $owed) => $owed > 0)
            ->sortDesc();

        $students = Student::with('classroom.grade')->whereIn('id', $balances->keys()->take($limit))->get()->keyBy('id');
        $rows = $balances->take($limit)
            ->map(fn (float $owed, int $id) => ($student = $students->get($id)) ? ['id' => $id, ...Lookup::student($student), 'owes' => Lookup::money($owed)] : null)
            ->filter()->values();

        return [
            'currency' => Setting::currency(),
            'source' => 'unpaid and partly paid fee charges',
            'students_owing' => $balances->count(),
            'total_owed' => Lookup::money($balances->sum()),
            'students' => $rows->map(fn ($row) => collect($row)->except('id')->all())->all(),
            // Each student's page has their charges and payments.
            'links' => $rows->take(3)->map(fn ($row) => ['href' => "/students/{$row['id']}", 'label' => $row['name']])->all(),
        ];
    }
}
