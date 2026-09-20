<?php

namespace App\Models;

use App\Enums\Gender;
use App\Enums\StudentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\Translatable\HasTranslations;

class Student extends Model implements HasMedia
{
    use HasTranslations, InteractsWithMedia;

    /**
     * Stored as a JSON object of locale => text, same convention as
     * Stage::$translatable.
     */
    public array $translatable = ['name'];

    protected $fillable = [
        'user_id',
        'parent_user_id',
        'name',
        'gender',
        'nationality_id',
        'governorate_id',
        'blood_type_id',
        'stage_id',
        'grade_id',
        'classroom_id',
        'academic_year_id',
        'status',
    ];

    protected $casts = [
        'gender' => Gender::class,
        'status' => StudentStatus::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parentUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'parent_user_id');
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

    public function father(): HasOne
    {
        return $this->hasOne(Father::class);
    }

    public function mother(): HasOne
    {
        return $this->hasOne(Mother::class);
    }

    public function promotions(): HasMany
    {
        return $this->hasMany(Promotion::class);
    }

    public function graduations(): HasMany
    {
        return $this->hasMany(Graduation::class);
    }

    public function feeCharges(): HasMany
    {
        return $this->hasMany(FeeCharge::class);
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('attachments');
    }
}
