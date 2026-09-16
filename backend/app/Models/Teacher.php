<?php

namespace App\Models;

use App\Enums\TeacherStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Teacher extends Model
{
    protected $fillable = [
        'name',
        'email',
        'phone',
        'joining_date',
        'status',
    ];

    protected $casts = [
        'joining_date' => 'date',
        'status' => TeacherStatus::class,
    ];

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class);
    }
}
