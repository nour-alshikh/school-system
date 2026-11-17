<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One AI call, without its content (docs/ai-assistant-plan.md, rule 7).
 * Platform-wide, not school-scoped: the central dashboard sums it across
 * schools. Written by AiClient only.
 */
class AiUsage extends Model
{
    protected $table = 'ai_usage';

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id', 'school_id', 'feature', 'model', 'prompt_tokens',
        'completion_tokens', 'duration_ms', 'ok', 'error',
    ];

    protected $casts = [
        'prompt_tokens' => 'integer',
        'completion_tokens' => 'integer',
        'duration_ms' => 'integer',
        'ok' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    /** Calls since the start of today (app time zone) by this user, or at this school. */
    public static function todayCount(string $column, int $id): int
    {
        return static::where($column, $id)->where('created_at', '>=', now()->startOfDay())->count();
    }
}
