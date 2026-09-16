<?php

namespace App\Models;

use App\Enums\TeacherStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    /**
     * This teacher's classroom subject assignments — see
     * TeacherController::update(), which nulls teacher_id here (instead of
     * deleting the rows) when this teacher goes inactive.
     */
    public function classroomSubjects(): HasMany
    {
        return $this->hasMany(ClassroomSubjectTeacher::class);
    }
}
