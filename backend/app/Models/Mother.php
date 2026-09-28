<?php

namespace App\Models;

use App\Tenancy\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mother extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'student_id',
        'name',
        'job',
        'national_id',
        'phone',
        'nationality_id',
        'governorate_id',
        'blood_type_id',
        'religion_id',
        'address',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function nationality(): BelongsTo
    {
        return $this->belongsTo(Nationality::class);
    }

    public function governorate(): BelongsTo
    {
        return $this->belongsTo(Governorate::class);
    }

    public function bloodType(): BelongsTo
    {
        return $this->belongsTo(BloodType::class);
    }

    public function religion(): BelongsTo
    {
        return $this->belongsTo(Religion::class);
    }
}
