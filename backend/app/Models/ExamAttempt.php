<?php

namespace App\Models;

use App\Enums\ExamAttemptStatus;
use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExamAttempt extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'exam_id',
        'student_id',
        'status',
        'started_at',
        'submitted_at',
        'score',
    ];

    protected $casts = [
        'status' => ExamAttemptStatus::class,
        'started_at' => 'datetime',
        'submitted_at' => 'datetime',
    ];

    public function exam(): BelongsTo
    {
        return $this->belongsTo(Exam::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ExamAttemptAnswer::class, 'attempt_id');
    }
}
