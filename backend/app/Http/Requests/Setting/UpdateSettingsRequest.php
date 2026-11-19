<?php

namespace App\Http\Requests\Setting;

use App\Services\SchoolProvisioner;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'settings' => ['required', 'array', 'min:1'],
            // The keys every school has (SchoolProvisioner), not "exists:settings,key":
            // that checks every school's rows, and a school missing a row (one
            // added by a migration that hasn't run yet) would still fail or
            // silently save nothing. File settings have their own endpoint.
            'settings.*.key' => ['required', 'string', Rule::in(self::textKeys())],
            'settings.*.value' => ['nullable', 'string'],
        ];
    }

    /**
     * Settings the app reads (not just displays) need a valid value. Errors
     * are keyed by the setting's own key, so the form shows them on that
     * field.
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            foreach ($this->input('settings', []) as $item) {
                $value = $item['value'] ?? null;
                if (! is_string($value) || $value === '') {
                    continue;
                }

                match ($item['key'] ?? null) {
                    'currency' => in_array($value, config('schools.currencies'), true)
                        || $validator->errors()->add('currency', __('validation.school_currency')),
                    'school_days' => $this->validSchoolDays($value)
                        || $validator->errors()->add('school_days', __('validation.school_days')),
                    'ai_enabled', 'assistant_data' => in_array($value, ['0', '1'], true)
                        || $validator->errors()->add($item['key'], __('validation.boolean', ['attribute' => $item['key']])),
                    default => null,
                };
            }
        }];
    }

    /** Settings this form may write: the defaults, less files and the setup checklist's own flag. */
    public static function textKeys(): array
    {
        return array_values(array_diff(
            array_keys(SchoolProvisioner::DEFAULT_SETTINGS),
            ['logo', 'favicon', 'og_image', 'onboarding_dismissed_at'],
        ));
    }

    /** "0,1,2,3,4": distinct weekday numbers 0 (Sunday) – 6 (Saturday). */
    private function validSchoolDays(string $value): bool
    {
        if (! preg_match('/^[0-6](,[0-6])*$/', $value)) {
            return false;
        }

        $days = explode(',', $value);

        return count($days) === count(array_unique($days));
    }
}
