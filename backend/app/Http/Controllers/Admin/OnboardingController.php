<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SettingGroup;
use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\SchoolStructureTemplate;
use App\TypeScript\OnboardingType;
use Illuminate\Http\JsonResponse;

/**
 * The setup checklist on a school admin's dashboard. See
 * docs/self-service-schools-plan.md, phase 4.
 */
class OnboardingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['onboarding' => OnboardingType::build()]);
    }

    public function dismiss(): JsonResponse
    {
        // Schools created before this setting existed don't have the row.
        Setting::updateOrCreate(
            ['key' => 'onboarding_dismissed_at'],
            ['value' => now()->toJSON(), 'group' => SettingGroup::General],
        );

        return response()->json(['onboarding' => OnboardingType::build()]);
    }

    /** "Create a standard structure": only for a school that has none yet. */
    public function standardStructure(SchoolStructureTemplate $template): JsonResponse
    {
        $template->applyToEmptySchool();

        return response()->json(['onboarding' => OnboardingType::build()], 201);
    }
}
