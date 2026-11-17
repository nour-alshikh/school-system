<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A turn in an assistant conversation: the user's question or the reply. */
class AssistantMessage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['conversation_id', 'role', 'content', 'links', 'tools', 'action'];

    protected $casts = ['links' => 'array', 'tools' => 'array', 'action' => 'array'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AssistantConversation::class, 'conversation_id');
    }
}
