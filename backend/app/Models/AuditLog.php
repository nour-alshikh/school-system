<?php

namespace App\Models;

use App\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * What a system admin did, and where (docs/central-dashboard-plan.md,
 * phase 2). Append-only: no update or delete route, no updated_at. Not
 * BelongsToSchool: it's platform-wide and read through explicit queries.
 */
class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'actor_id',
        'school_id',
        'action',
        'subject_type',
        'subject_id',
        'details',
        'ip',
        'user_agent',
    ];

    protected $casts = [
        'details' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * Records $action by the signed-in user. The school is $school if
     * given, else $subject's when it is one, else the current school.
     *
     * @param  array<string, mixed>  $details  e.g. changed fields, before/after
     */
    public static function record(string $action, ?Model $subject = null, array $details = [], ?School $school = null, ?User $actor = null): self
    {
        $request = request();
        $context = app(TenantContext::class);

        $schoolId = $school?->id
            ?? ($subject instanceof School ? $subject->id : null)
            ?? ($context->has() ? $context->id() : null);

        return static::create([
            'actor_id' => ($actor ?? $request->user())?->id,
            'school_id' => $schoolId,
            'action' => $action,
            'subject_type' => $subject ? $subject->getMorphClass() : null,
            'subject_id' => $subject?->getKey(),
            'details' => $details ?: null,
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 500) ?: null,
        ]);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
