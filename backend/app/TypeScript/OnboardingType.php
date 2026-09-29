<?php

namespace App\TypeScript;

use App\Models\AcademicYear;
use App\Models\Classroom;
use App\Models\Grade;
use App\Models\Setting;
use App\Models\Stage;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

/**
 * A new school's setup checklist, in the order things depend on each other
 * (students need classrooms, classrooms need grades…). Computed live from
 * counts, so nothing about progress is stored — only the dismissal. See
 * docs/self-service-schools-plan.md, phase 4.
 */
#[TypeScript]
final class OnboardingType
{
    /**
     * @param  OnboardingStepType[]  $steps
     */
    public function __construct(
        public readonly array $steps,
        public readonly bool $dismissed,
    ) {}

    public static function build(): self
    {
        $settings = Setting::whereIn('key', ['primary_color', 'logo', 'currency', 'school_days', 'onboarding_dismissed_at'])->get()->keyBy('key');

        $counted = fn (string $key, int $count) => new OnboardingStepType($key, $count > 0, $count);

        return new self(
            steps: [
                new OnboardingStepType(
                    'branding',
                    filled($settings->get('primary_color')?->value) || (bool) $settings->get('logo')?->hasMedia('file'),
                    null,
                ),
                new OnboardingStepType(
                    'school_week_currency',
                    filled($settings->get('currency')?->value) && filled($settings->get('school_days')?->value),
                    null,
                ),
                $counted('academic_year', AcademicYear::where('is_current', true)->count()),
                $counted('stages', Stage::count()),
                $counted('grades', Grade::count()),
                $counted('classrooms', Classroom::count()),
                $counted('subjects', Subject::count()),
                $counted('teachers', Teacher::count()),
                $counted('students', Student::count()),
            ],
            dismissed: filled($settings->get('onboarding_dismissed_at')?->value),
        );
    }
}
