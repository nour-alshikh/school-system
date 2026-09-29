<?php

namespace App\Platform;

use App\Enums\MembershipRole;
use App\Enums\MembershipStatus;
use App\Enums\SchoolStatus;
use App\Enums\StudentStatus;
use App\Models\AuditLog;
use App\Models\School;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The central dashboard's numbers (docs/central-dashboard-plan.md, phase 4).
 * This is the one place that reads across schools, besides ParentChildren.
 * Aggregates only: it never lists individual students. Plain query-builder
 * queries grouped by school_id, so no school scope applies, and cached for
 * 10 minutes. The dashboard's Refresh button passes fresh: true.
 */
class SchoolMetrics
{
    private const CACHE_KEY = 'platform:metrics:schools';

    private const CACHE_SECONDS = 600;

    /** Days without anyone active before a school gets the "inactive" warning. */
    private const INACTIVE_DAYS = 30;

    /** School days without attendance before a school gets that warning. */
    private const ATTENDANCE_GAP_SCHOOL_DAYS = 5;

    /**
     * One row per school, with its warnings.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function schools(bool $fresh = false): Collection
    {
        if ($fresh) {
            Cache::forget(self::CACHE_KEY);
        }

        return collect(Cache::remember(self::CACHE_KEY, self::CACHE_SECONDS, fn () => $this->computeSchools()));
    }

    /** The overview: platform totals and the schools table. */
    public function overview(bool $fresh = false): array
    {
        $schools = $this->schools($fresh);

        return [
            'totals' => [
                'schools' => collect(SchoolStatus::cases())->mapWithKeys(fn ($s) => [$s->value => $schools->where('status', $s->value)->count()])->all(),
                'students' => $schools->sum('students'),
                'teachers' => $schools->sum('teachers'),
                'parents' => $schools->sum('parents'),
                'active_users_7d' => $schools->sum('active_users_7d'),
            ],
            // Amounts in different currencies can't be added up: one line per currency.
            'collected_this_month' => $schools
                ->groupBy(fn ($s) => $s['currency'] ?? '')
                ->map(fn ($rows, $currency) => ['currency' => $currency ?: null, 'amount' => $this->money($rows->sum('collected_this_month'))])
                ->values()
                ->all(),
            'schools' => $schools->values()->all(),
            'generated_at' => Cache::get(self::CACHE_KEY.':at', now())->toJSON(),
        ];
    }

    /** Everything on one school's detail page. Live, not cached: it's one school. */
    public function school(School $school): array
    {
        $row = $this->schools()->firstWhere('id', $school->id) ?? $this->computeSchools()->firstWhere('id', $school->id);
        $yearId = $this->currentYearIds()->get($school->id);

        return [
            'school' => [
                ...$row,
                'created_by' => $school->createdBy?->only(['id', 'name', 'email']),
                'school_days' => $this->schoolDays()->get($school->id),
            ],
            'admins' => DB::table('school_memberships')
                ->join('users', 'users.id', '=', 'school_memberships.user_id')
                ->where('school_memberships.school_id', $school->id)
                ->where('school_memberships.role', MembershipRole::Admin->value)
                ->orderBy('users.name')
                ->get(['users.id', 'users.name', 'users.email', 'users.last_login_at', 'school_memberships.status', 'school_memberships.last_seen_at'])
                ->map(fn ($a) => [...(array) $a, 'last_login_at' => $this->iso($a->last_login_at), 'last_seen_at' => $this->iso($a->last_seen_at)])
                ->all(),
            'people' => DB::table('school_memberships')
                ->where('school_id', $school->id)
                ->where('status', MembershipStatus::Active->value)
                ->selectRaw('role, count(*) as count')
                ->groupBy('role')
                ->pluck('count', 'role')
                ->map(fn ($n) => (int) $n)
                ->all(),
            'finance' => $this->finance($school->id, $yearId),
            'activity' => $this->activity($school->id),
            'usage' => [
                'storage_by_collection' => DB::table('media')
                    ->where('school_id', $school->id)
                    ->selectRaw('collection_name as collection, sum(size) as bytes, count(*) as files')
                    ->groupBy('collection_name')
                    ->get()
                    ->map(fn ($r) => ['collection' => $r->collection, 'bytes' => (int) $r->bytes, 'files' => (int) $r->files])
                    ->all(),
            ],
            'audit' => AuditLog::with('actor:id,name,email')
                ->where('school_id', $school->id)
                ->latest('id')
                ->take(20)
                ->get()
                ->map(fn (AuditLog $log) => AuditLogResource::from($log))
                ->all(),
        ];
    }

    /** @return Collection<int, array<string, mixed>> */
    private function computeSchools(): Collection
    {
        Cache::forever(self::CACHE_KEY.':at', now());

        $students = $this->countBySchool(DB::table('students')->where('status', StudentStatus::Active->value));
        $members = DB::table('school_memberships')
            ->where('status', MembershipStatus::Active->value)
            ->selectRaw('school_id, role, count(*) as n')
            ->groupBy('school_id', 'role')
            ->get()
            ->groupBy('school_id');
        $active7 = $this->countBySchool(DB::table('school_memberships')->where('last_seen_at', '>=', now()->subDays(7)), 'distinct user_id');
        $lastSeen = DB::table('school_memberships')->selectRaw('school_id, max(last_seen_at) as at')->groupBy('school_id')->pluck('at', 'school_id');
        $storage = DB::table('media')->whereNotNull('school_id')->selectRaw('school_id, sum(size) as bytes')->groupBy('school_id')->pluck('bytes', 'school_id');
        $lastAttendance = DB::table('attendances')->selectRaw('school_id, max(date) as d')->groupBy('school_id')->pluck('d', 'school_id');
        $collectedThisMonth = DB::table('fee_payments')->where('paid_at', '>=', now()->startOfMonth()->toDateString())
            ->selectRaw('school_id, sum(amount) as total')->groupBy('school_id')->pluck('total', 'school_id');
        [$charged, $collected] = $this->currentYearFees();
        $currencies = DB::table('settings')->where('key', 'currency')->pluck('value', 'school_id');
        $schoolDays = $this->schoolDays();

        return School::orderBy('name')->get()->map(function (School $school) use (
            $students, $members, $active7, $lastSeen, $storage, $lastAttendance, $collectedThisMonth, $charged, $collected, $currencies, $schoolDays
        ) {
            $roles = ($members->get($school->id) ?? collect())->pluck('n', 'role')->map(fn ($n) => (int) $n);
            $lastActivity = $lastSeen->get($school->id);

            $row = [
                'id' => $school->id,
                'name' => $school->name,
                'slug' => $school->slug,
                'status' => $school->status->value,
                'source' => $school->source->value,
                'created_at' => $school->created_at->toJSON(),
                'currency' => $currencies->get($school->id),
                'students' => (int) ($students->get($school->id) ?? 0),
                'teachers' => $roles->get(MembershipRole::Teacher->value, 0),
                'parents' => $roles->get(MembershipRole::Parent->value, 0),
                'admins' => $roles->get(MembershipRole::Admin->value, 0),
                'outstanding' => $this->money(max(0, (float) ($charged->get($school->id) ?? 0) - (float) ($collected->get($school->id) ?? 0))),
                'collected_this_month' => $this->money((float) ($collectedThisMonth->get($school->id) ?? 0)),
                'active_users_7d' => (int) ($active7->get($school->id) ?? 0),
                'last_activity_at' => $this->iso($lastActivity),
                'last_attendance_on' => $lastAttendance->get($school->id),
                'storage_bytes' => (int) ($storage->get($school->id) ?? 0),
            ];

            return [...$row, 'warnings' => $this->warnings($school, $row, $schoolDays->get($school->id))];
        });
    }

    /**
     * @param  list<int>|null  $schoolDays
     * @return list<string>
     */
    private function warnings(School $school, array $row, ?array $schoolDays): array
    {
        $warnings = [];

        if ($school->status === SchoolStatus::Suspended) {
            $warnings[] = 'suspended';
        }
        if ($school->status === SchoolStatus::Active && $row['admins'] === 0) {
            $warnings[] = 'no_admin';
        }

        // A school created in the last month hasn't had the chance.
        $oldEnough = $school->created_at->lt(now()->subDays(self::INACTIVE_DAYS));
        if ($oldEnough && ($row['last_activity_at'] === null || Carbon::parse($row['last_activity_at'])->lt(now()->subDays(self::INACTIVE_DAYS)))) {
            $warnings[] = 'inactive';
        }

        if ($row['students'] > 0 && $this->missedAttendance($row['last_attendance_on'], $schoolDays)) {
            $warnings[] = 'attendance_gap';
        }

        return $warnings;
    }

    /** No attendance on any of the school's last few school days (today excluded: it may not be taken yet). */
    private function missedAttendance(?string $lastOn, ?array $schoolDays): bool
    {
        $schoolDays ??= [0, 1, 2, 3, 4, 5, 6];
        $day = Carbon::yesterday();
        $counted = 0;

        while ($counted < self::ATTENDANCE_GAP_SCHOOL_DAYS) {
            if (in_array($day->dayOfWeek, $schoolDays, true)) {
                $counted++;
            }
            if ($counted < self::ATTENDANCE_GAP_SCHOOL_DAYS) {
                $day = $day->subDay();
            }
        }

        return $lastOn === null || Carbon::parse($lastOn)->lt($day);
    }

    private function finance(int $schoolId, ?int $yearId): array
    {
        $charges = DB::table('fee_charges')->where('school_id', $schoolId)->when($yearId, fn ($q) => $q->where('academic_year_id', $yearId));

        $charged = (float) (clone $charges)->where('status', '!=', 'waived')->sum('amount_due');
        $collected = (float) DB::table('fee_payments')
            ->join('fee_charges', 'fee_charges.id', '=', 'fee_payments.fee_charge_id')
            ->where('fee_payments.school_id', $schoolId)
            ->when($yearId, fn ($q) => $q->where('fee_charges.academic_year_id', $yearId))
            ->sum('fee_payments.amount');

        $since = now()->startOfMonth()->subMonths(5);
        $byMonth = DB::table('fee_payments')->where('school_id', $schoolId)->where('paid_at', '>=', $since->toDateString())
            ->get(['paid_at', 'amount'])
            ->groupBy(fn ($p) => substr((string) $p->paid_at, 0, 7))
            ->map(fn ($rows) => $rows->sum(fn ($p) => (float) $p->amount));

        return [
            'currency' => DB::table('settings')->where('school_id', $schoolId)->where('key', 'currency')->value('value'),
            'year' => $yearId ? DB::table('academic_years')->where('id', $yearId)->value('year') : null,
            'charged' => $this->money($charged),
            'collected' => $this->money($collected),
            'outstanding' => $this->money(max(0, $charged - $collected)),
            'status_counts' => (clone $charges)->selectRaw('status, count(*) as n')->groupBy('status')->pluck('n', 'status')->map(fn ($n) => (int) $n)->all(),
            'collections_by_month' => collect(range(0, 5))->map(function (int $i) use ($since, $byMonth) {
                $month = $since->copy()->addMonths($i)->format('Y-m');

                return ['month' => $month, 'amount' => $this->money($byMonth->get($month, 0))];
            })->all(),
        ];
    }

    private function activity(int $schoolId): array
    {
        $byRole = fn (int $days) => DB::table('school_memberships')
            ->where('school_id', $schoolId)
            ->where('last_seen_at', '>=', now()->subDays($days))
            ->selectRaw('role, count(distinct user_id) as n')
            ->groupBy('role')
            ->pluck('n', 'role')
            ->map(fn ($n) => (int) $n)
            ->all();

        // School days in the last 30 with any attendance recorded, of the
        // school days there were.
        $days = $this->schoolDays()->get($schoolId) ?? [0, 1, 2, 3, 4, 5, 6];
        $schoolDaysInWindow = collect(range(1, 30))->filter(fn ($i) => in_array(now()->subDays($i)->dayOfWeek, $days, true))->count();
        $recordedDays = DB::table('attendances')->where('school_id', $schoolId)
            ->where('date', '>=', now()->subDays(30)->toDateString())->where('date', '<', now()->toDateString())
            ->distinct()->count('date');

        return [
            'active_7d_by_role' => $byRole(7),
            'active_30d_by_role' => $byRole(30),
            'attendance_rate_30d' => $schoolDaysInWindow ? round(min(1, $recordedDays / $schoolDaysInWindow), 2) : null,
            'recent' => DB::table('school_memberships')
                ->join('users', 'users.id', '=', 'school_memberships.user_id')
                ->where('school_memberships.school_id', $schoolId)
                ->whereNotNull('school_memberships.last_seen_at')
                ->orderByDesc('school_memberships.last_seen_at')
                ->take(10)
                ->get(['users.name', 'users.email', 'school_memberships.role', 'school_memberships.last_seen_at'])
                ->map(fn ($r) => [...(array) $r, 'last_seen_at' => $this->iso($r->last_seen_at)])
                ->all(),
        ];
    }

    /** @return array{0: Collection<int, string>, 1: Collection<int, string>} charged and collected this year, by school */
    private function currentYearFees(): array
    {
        $yearIds = $this->currentYearIds()->values()->all();

        $charged = DB::table('fee_charges')->whereIn('academic_year_id', $yearIds)->where('status', '!=', 'waived')
            ->selectRaw('school_id, sum(amount_due) as total')->groupBy('school_id')->pluck('total', 'school_id');
        $collected = DB::table('fee_payments')
            ->join('fee_charges', 'fee_charges.id', '=', 'fee_payments.fee_charge_id')
            ->whereIn('fee_charges.academic_year_id', $yearIds)
            ->selectRaw('fee_payments.school_id, sum(fee_payments.amount) as total')->groupBy('fee_payments.school_id')->pluck('total', 'school_id');

        return [$charged, $collected];
    }

    /** @return Collection<int, int> school id => its current academic year's id */
    private function currentYearIds(): Collection
    {
        return DB::table('academic_years')->where('is_current', true)->pluck('id', 'school_id');
    }

    /** @return Collection<int, list<int>> school id => weekday numbers, where chosen */
    private function schoolDays(): Collection
    {
        return DB::table('settings')->where('key', 'school_days')->whereNotNull('value')->where('value', '!=', '')
            ->pluck('value', 'school_id')
            ->map(fn ($v) => array_map('intval', explode(',', $v)));
    }

    private function countBySchool($query, string $what = '*'): Collection
    {
        return $query->selectRaw("school_id, count({$what}) as n")->groupBy('school_id')->pluck('n', 'school_id');
    }

    private function money(float|int|string $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }

    private function iso(?string $timestamp): ?string
    {
        return $timestamp ? Carbon::parse($timestamp)->toJSON() : null;
    }
}
