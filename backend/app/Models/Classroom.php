<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Classroom extends Model
{
    protected $fillable = [
        'grade_id',
        'name',
        'capacity',
    ];

    public function grade(): BelongsTo
    {
        return $this->belongsTo(Grade::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }

    /**
     * Per-subject teacher assignments for this classroom. Each row also
     * records the subject, so unlike Teacher::subjects() (which subjects a
     * teacher can teach in general) this is which teacher teaches which
     * subject in this specific classroom.
     */
    public function subjectTeachers(): HasMany
    {
        return $this->hasMany(ClassroomSubjectTeacher::class);
    }

    public function teachers(): BelongsToMany
    {
        return $this->belongsToMany(Teacher::class, 'classroom_subject_teacher')
            ->withPivot('subject_id')
            ->withTimestamps();
    }
}
