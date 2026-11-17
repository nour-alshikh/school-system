<?php

namespace App\Http\Controllers\Concerns;

use App\Services\Ai\AiCapReached;
use App\Services\Ai\AiClient;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * The same answers for every AI endpoint: 503 without a key, 429 when
 * today's calls are used up, 502 with a friendly message when the provider
 * fails or the reply isn't usable (reported, so it can be looked into).
 */
trait RespondsWithAiDraft
{
    /** @param  callable(): array  $draft */
    protected function aiDraft(callable $draft): JsonResponse
    {
        return response()->json(['draft' => $this->aiCall($draft)]);
    }

    /**
     * Runs an AI call, turning its failures into those responses.
     *
     * @template T
     *
     * @param  callable(): T  $call
     * @return T
     */
    protected function aiCall(callable $call, string $failed = 'api.ai_draft_failed'): mixed
    {
        abort_unless(app(AiClient::class)->isConfigured(), 503, __('api.ai_not_configured'));

        try {
            return $call();
        } catch (AiCapReached $e) {
            abort(429, __("api.ai_cap_reached_{$e->scope}"));
        } catch (RuntimeException $e) {
            report($e);
            abort(502, __($failed));
        }
    }
}
