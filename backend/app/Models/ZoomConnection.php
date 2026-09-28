<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The one shared Zoom account every meeting gets created under — see
 * ZoomService. At most one row ever exists; connecting a new account
 * replaces it rather than adding a second.
 */
class ZoomConnection extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'access_token',
        'refresh_token',
        'expires_at',
        'connected_by',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    public function connectedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'connected_by');
    }
}
