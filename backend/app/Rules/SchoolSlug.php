<?php

namespace App\Rules;

use App\Models\School;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * A school's public identifier (X-School, pre-login branding): lowercase
 * words joined by single dashes, not reserved, not taken. One rule for
 * every place a slug is chosen, so they can't disagree.
 */
class SchoolSlug implements ValidationRule
{
    public const PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /**
     * Why $slug can't be used, or null when it's free.
     *
     * @return 'invalid'|'reserved'|'taken'|null
     */
    public static function problem(string $slug): ?string
    {
        return match (true) {
            strlen($slug) < 3 || strlen($slug) > 63 || ! preg_match(self::PATTERN, $slug) => 'invalid',
            in_array($slug, config('schools.reserved_slugs'), true) => 'reserved',
            School::where('slug', $slug)->exists() => 'taken',
            default => null,
        };
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $problem = is_string($value) ? self::problem($value) : 'invalid';

        if ($problem !== null) {
            $fail(__("validation.school_slug.{$problem}"));
        }
    }
}
