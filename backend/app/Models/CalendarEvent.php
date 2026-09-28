<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CalendarEvent extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'title',
        'description',
        'date',
        'created_by',
    ];

    protected $casts = [
        // Explicit format — the plain 'date' cast serializes as
        // 'Y-m-d H:i:s' by default, which wouldn't match the 'Y-m-d' the
        // frontend's calendar grid keys events by.
        'date' => 'date:Y-m-d',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
