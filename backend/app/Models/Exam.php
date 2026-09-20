<?php

namespace App\Models;

use App\Enums\ExamStatus;
use App\Enums\ExamType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Exam extends Model
{
    protected $fillable = [
        'title',
        'type',
        'subject_id',
        'grade_id',
        'classroom_id',
        'academic_year_id',
        'created_by',
        'instructions',
        'duration_minutes',
        'opens_at',
        'closes_at',
        'status',
    ];

    protected $casts = [
        'type' => ExamType::class,
        'status' => ExamStatus::class,
        'opens_at' => 'datetime',
        'closes_at' => 'datetime',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    /**
     * Null means the exam targets every classroom in grade() — see the
     * eligibility query in StudentPortal\ExamController.
     */
    public function classroom(): BelongsTo
    {
        return $this->belongsTo(Classroom::class);
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function questions(): HasMany
    {
        return $this->hasMany(ExamQuestion::class)->orderBy('order');
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(ExamAttempt::class);
    }
}
