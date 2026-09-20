<?php

namespace App\Models;

use App\Enums\TeacherStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Teacher extends Model
{
    protected $fillable = [
        'user_id',
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

    /**
     * Nullable — see the add_user_id_to_teachers_table migration. A teacher
     * without one can't log in or be assigned attendance-marking access
     * (AttendanceController checks this).
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function subjects(): BelongsToMany
    {
        return $this->belongsToMany(Subject::class);
    }

    /**
     * This teacher's classroom subject assignments — see
     * TeacherController::update()/destroy(), which block going
     * inactive/on_leave or being deleted while any of these exist.
     */
    public function classroomSubjects(): HasMany
    {
        return $this->hasMany(ClassroomSubjectTeacher::class);
    }
}
