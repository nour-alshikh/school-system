<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamAttemptAnswer extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'attempt_id',
        'question_id',
        'selected_option_id',
        'is_correct',
        'marks_awarded',
    ];

    protected $casts = [
        'is_correct' => 'boolean',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(ExamAttempt::class, 'attempt_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(ExamQuestion::class, 'question_id');
    }

    public function selectedOption(): BelongsTo
    {
        return $this->belongsTo(ExamQuestionOption::class, 'selected_option_id');
    }
}
