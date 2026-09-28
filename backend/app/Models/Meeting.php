<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Meeting extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'title',
        'description',
        'start_time',
        'duration_minutes',
        'zoom_meeting_id',
        'join_url',
        'start_url',
        'academic_year_id',
        'created_by',
    ];

    protected $casts = [
        'start_time' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function classrooms(): BelongsToMany
    {
        return $this->belongsToManyInSchool(Classroom::class, 'meeting_classroom');
    }
}
