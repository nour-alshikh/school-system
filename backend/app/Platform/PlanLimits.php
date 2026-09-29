<?php

namespace App\Platform;

use App\Enums\StudentStatus;
use App\Models\Plan;
use App\Models\School;
use App\Models\Student;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Enforces the current school's plan (docs/central-dashboard-plan.md,
 * phase 9), server side — the frontend only hides what isn't included.
 */
class PlanLimits
{
    public function __construct(private readonly TenantContext $context) {}

    public function plan(): ?Plan
    {
        return $this->context->has() ? $this->context->school()->effectivePlan() : null;
    }

    /** Before registering a student: refused at the plan's limit. */
    public function ensureRoomForStudent(): void
    {
        $max = $this->plan()?->max_students;

        if ($max !== null && Student::where('status', StudentStatus::Active)->count() >= $max) {
            throw ValidationException::withMessages(['plan' => __('api.plan_student_limit', ['max' => $max])]);
        }
    }

    /** Before storing a file of $bytes for $school: refused past the plan's storage. */
    public function ensureRoomForFile(School $school, int $bytes): void
    {
        $maxMb = $school->effectivePlan()->max_storage_mb;

        if ($maxMb === null) {
            return;
        }

        $used = (int) DB::table('media')->where('school_id', $school->id)->sum('size');

        if ($used + $bytes > $maxMb * 1024 * 1024) {
            throw ValidationException::withMessages(['plan' => __('api.plan_storage_limit', ['max' => $this->humanMb($maxMb)])]);
        }
    }

    private function humanMb(int $mb): string
    {
        return $mb >= 1024 && $mb % 1024 === 0 ? ($mb / 1024).' GB' : $mb.' MB';
    }
}
