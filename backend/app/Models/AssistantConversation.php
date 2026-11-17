<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One chat with the assistant (docs/ai-assistant-plan.md, phase 4), owned
 * by a user at one school. assistant:prune reads across schools.
 */
class AssistantConversation extends Model
{
    use BelongsToSchool;

    /** Conversations untouched this long are deleted, and no longer offered. */
    public const KEEP_DAYS = 30;

    protected $fillable = ['user_id', 'school_id', 'title'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AssistantMessage::class, 'conversation_id')->orderBy('id');
    }

    /** This user's conversations (at the current school), still within the 30 days. */
    public function scopeOwnedBy(Builder $query, User $user): void
    {
        $query->where('user_id', $user->id)->where('updated_at', '>=', now()->subDays(self::KEEP_DAYS));
    }
}
