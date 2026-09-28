<?php

namespace App\Models;

use App\Enums\AttendanceStatus;
use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'student_id',
        'classroom_id',
        'academic_year_id',
        'date',
        'status',
        'notes',
        'recorded_by',
    ];

    protected $casts = [
        // Explicit format, not just 'date' — that cast still serializes as
        // 'Y-m-d H:i:s' by default (a well-known Laravel gotcha), which
        // wouldn't match the plain 'Y-m-d' string AttendanceController's
        // updateOrCreate() searches by, breaking the upsert entirely.
        'date' => 'date:Y-m-d',
        'status' => AttendanceStatus::class,
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function recordedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
