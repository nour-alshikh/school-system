<?php

namespace App\Http\Controllers;

use App\Models\AiUsage;
use App\Services\Ai\AiClient;
use App\Services\Ai\Drafts\SchoolBlueprintDrafter;
use App\Services\SchoolBlueprint;
use App\TypeScript\SchoolBlueprintType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

/**
 * "Describe your school" on the landing page (docs/ai-assistant-plan.md,
 * phase 2). Public — it's how schools sign up — so it's throttled per
 * address (the school-blueprint limiter) and capped per day across
 * everyone. It never fails the visitor: without AI, past the cap, or when
 * the reply isn't usable, it answers with the standard structure (or the
 * blueprint being refined, unchanged) and fallback: true.
 */
class SchoolBlueprintController extends Controller
{
    public function store(Request $request, SchoolBlueprintDrafter $drafter, AiClient $client): JsonResponse
    {
        // Same honeypot as signup: bots fill every field.
        if ($request->filled('website')) {
            Log::warning('School blueprint rejected by honeypot', ['ip' => $request->ip()]);
            abort(422, __('api.signup_rejected'));
        }

        $validator = Validator::make($request->all(), [
            'description' => ['required', 'string', 'max:500'],
            'blueprint' => ['nullable', 'array'],
            ...($request->filled('blueprint') ? SchoolBlueprint::rules('blueprint.') : []),
        ]);
        if ($request->filled('blueprint')) {
            $validator->after(SchoolBlueprint::after('blueprint.'));
        }
        $data = $validator->validate();
        $current = $data['blueprint'] ?? null;

        if (! $client->isConfigured() || $this->dailyCapReached()) {
            return $this->fallback($current);
        }

        try {
            $blueprint = $drafter->draft($data['description'], array_filter(['current' => $current]));
        } catch (RuntimeException $e) {
            report($e);

            return $this->fallback($current);
        }

        return response()->json(['blueprint' => SchoolBlueprintType::fromArray($blueprint), 'fallback' => false]);
    }

    private function dailyCapReached(): bool
    {
        $cap = config('ai.caps.blueprint_daily');

        return $cap !== null && AiUsage::where('feature', 'draft.school_blueprint')->where('created_at', '>=', now()->startOfDay())->count() >= (int) $cap;
    }

    /** The blueprint being refined, unchanged, or else the standard structure — with a note saying so. */
    private function fallback(?array $current): JsonResponse
    {
        $blueprint = $current
            ? [...$current, 'notes' => [__('api.blueprint_unchanged')]]
            : [...SchoolBlueprint::default(), 'notes' => [__('api.blueprint_fallback')]];

        return response()->json(['blueprint' => SchoolBlueprintType::fromArray($blueprint), 'fallback' => true]);
    }
}
