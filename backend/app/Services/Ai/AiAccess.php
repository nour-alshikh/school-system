<?php

namespace App\Services\Ai;

use App\Models\School;
use Illuminate\Support\Facades\DB;

/**
 * Whether a school can use AI features (docs/ai-assistant-plan.md, rule 6):
 * a key is set, its plan includes "ai", and its admin hasn't switched it
 * off (the ai_enabled setting). The same answer reaches the frontend as
 * the user's ai_available, so buttons hide instead of failing.
 */
class AiAccess
{
    public function __construct(private readonly AiClient $client) {}

    public function available(?School $school): bool
    {
        return $this->refusal($school) === null;
    }

    /**
     * Why $school can't use AI, as [HTTP status, api.* message key], or null when it can.
     *
     * @return array{0: int, 1: string}|null
     */
    public function refusal(?School $school): ?array
    {
        return match (true) {
            $school === null => [403, 'api.no_current_school'],
            ! $this->client->isConfigured() => [503, 'api.ai_not_configured'],
            ! $school->effectivePlan()->includes('ai') => [403, 'api.plan_feature_missing'],
            ! self::enabledAt($school) => [403, 'api.ai_disabled'],
            default => null,
        };
    }

    /**
     * Whether the assistant may look up the school's data (phase 5): AI is
     * available and an admin turned assistant_data on. Off by default, since
     * the results of those lookups are sent to the AI provider.
     */
    public function readsData(?School $school): bool
    {
        return $this->available($school)
            && DB::table('settings')->where('school_id', $school->id)->where('key', 'assistant_data')->value('value') === '1';
    }

    /** The school's ai_enabled setting: on unless set to "0". Read directly, so it works outside the school's context too. */
    public static function enabledAt(School $school): bool
    {
        return DB::table('settings')->where('school_id', $school->id)->where('key', 'ai_enabled')->value('value') !== '0';
    }
}
