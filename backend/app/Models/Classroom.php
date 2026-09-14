<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Classroom extends Model
{
    protected $fillable = [
        'grade_id',
        'name',
        'capacity',
    ];

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }
}
