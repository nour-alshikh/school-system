<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A log row created once by GraduationService::graduate() — stage/grade/
 * classroom/academic_year are a snapshot taken at graduation time (see the
 * migration), not a live reference; the student's own record is untouched
 * apart from its status. The only update it ever gets is
 * GraduationService::rollbackMany() setting rolled_back_at/rolled_back_by;
 * the row itself is never deleted, so the log stays complete even for an
 * undone graduation.
 */
class Graduation extends Model
{
    protected $fillable = [
        'student_id',
        'stage_id',
        'grade_id',
        'classroom_id',
        'academic_year_id',
        'graduated_by',
        'rolled_back_at',
        'rolled_back_by',
    ];

    protected $casts = [
        'rolled_back_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(Stage::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function graduatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'graduated_by');
    }

    public function rolledBackBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rolled_back_by');
    }
}
