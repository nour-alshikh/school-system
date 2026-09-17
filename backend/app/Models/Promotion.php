<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A log row created once by PromotionService::promote() — every from_ and
 * to_ column is a snapshot taken at promotion time (see the migration),
 * not a live reference to the student's current stage/grade/classroom.
 * The only update it ever gets is PromotionService::rollbackMany() setting
 * rolled_back_at/rolled_back_by; the row itself is never deleted, so the
 * log stays complete even for an undone promotion.
 */
class Promotion extends Model
{
    protected $fillable = [
        'student_id',
        'from_stage_id',
        'from_grade_id',
        'from_classroom_id',
        'from_academic_year_id',
        'to_stage_id',
        'to_grade_id',
        'to_classroom_id',
        'to_academic_year_id',
        'promoted_by',
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

    public function fromStage(): BelongsTo
    {
        return $this->belongsTo(Stage::class, 'from_stage_id');
    }

    public function fromGrade(): BelongsTo
    {
        return $this->belongsTo(Grade::class, 'from_grade_id');
    }

    public function fromClassroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class, 'from_classroom_id');
    }

    public function fromAcademicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'from_academic_year_id');
    }

    public function toStage(): BelongsTo
    {
        return $this->belongsTo(Stage::class, 'to_stage_id');
    }

    public function toGrade(): BelongsTo
    {
        return $this->belongsTo(Grade::class, 'to_grade_id');
    }

    public function toClassroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class, 'to_classroom_id');
    }

    public function toAcademicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class, 'to_academic_year_id');
    }

    public function promotedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'promoted_by');
    }

    public function rolledBackBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rolled_back_by');
    }
}
