<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClassroomSubjectTeacher extends Model
{
    protected $table = 'classroom_subject_teacher';

    protected $fillable = [
        'classroom_id',
        'subject_id',
        'teacher_id',
    ];
}
