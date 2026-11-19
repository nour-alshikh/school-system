<?php

namespace App\Services\Ai;

use App\Models\AiUsage;
use App\Tenancy\TenantContext;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * The one place that talks to the AI provider (docs/ai-assistant-plan.md,
 * phase 1): OpenRouter's chat completions, with the key and model from
 * services.openrouter — the call AnnouncementWriter made, shared.
 *
 * The free model doesn't support response_format or tool calling, so the
 * reply is asked for as JSON in the prompt and parsed leniently: the first
 * {...} in it, whatever surrounds it. Every call is checked against the
 * daily caps first and logged to ai_usage after (never its content).
 */
class AiClient
{
    public function __construct(private readonly TenantContext $context) {}

    /** A key is set and AI isn't switched off (config ai.enabled). */
    public function isConfigured(): bool
    {
        return (bool) config('ai.enabled') && filled(config('services.openrouter.key'));
    }

    /**
     * Sends a system prompt and a user message, returns the reply's JSON
     * object — passed through $shape when given, which validates it and
     * throws a RuntimeException when it isn't usable (logged as bad_reply).
     *
     * @param  string  $feature  what the call is for, as logged (e.g. "draft.announcement")
     * @param  (callable(array): array)|null  $shape
     *
     * @throws AiCapReached when the user or school has used today's calls
     * @throws RuntimeException when the provider can't be reached or the reply isn't usable
     */
    public function json(string $feature, string $system, string $user, ?callable $shape = null, float $temperature = 0.4, int $maxTokens = 1500): array
    {
        return $this->chat($feature, $system, [['role' => 'user', 'content' => $user]], $shape, $temperature, $maxTokens);
    }

    /**
     * Like json(), with a conversation instead of one message: earlier turns
     * first, the new user message last (the assistant, phase 4).
     *
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     * @param  (callable(array): array)|null  $shape
     *
     * @throws AiCapReached
     * @throws RuntimeException
     */
    public function chat(string $feature, string $system, array $messages, ?callable $shape = null, float $temperature = 0.4, int $maxTokens = 1500): array
    {
        $this->ensureWithinCaps();

        $started = hrtime(true);
        $log = fn (bool $ok, ?string $error = null, array $reply = []) => $this->log($feature, $started, $ok, $error, $reply);

        try {
            $response = Http::withToken(config('services.openrouter.key'))
                ->withHeaders(['X-Title' => config('app.name')])
                ->timeout(60)
                ->post(rtrim(config('services.openrouter.url'), '/').'/chat/completions', [
                    'model' => config('services.openrouter.model'),
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ...array_map(fn (array $m) => ['role' => $m['role'], 'content' => $m['content']], $messages),
                    ],
                    'temperature' => $temperature,
                    'max_tokens' => $maxTokens,
                    // A reasoning model: keep the thinking short and out of the reply.
                    'reasoning' => ['effort' => 'low', 'exclude' => true],
                ]);
        } catch (ConnectionException $e) {
            $log(false, 'unreachable');
            throw new RuntimeException('OpenRouter unreachable: '.$e->getMessage(), previous: $e);
        }

        if ($response->failed()) {
            $log(false, 'http_'.$response->status(), (array) $response->json());
            throw new RuntimeException("OpenRouter returned {$response->status()}: ".$response->body());
        }

        $reply = (array) $response->json();
        $content = (string) data_get($reply, 'choices.0.message.content');

        try {
            $data = self::extractJson($content);
            if ($data === null) {
                throw new RuntimeException("Reply isn't JSON: {$content}");
            }
            $result = $shape ? $shape($data) : $data;
        } catch (RuntimeException $e) {
            $log(false, 'bad_reply', $reply);
            throw $e;
        }

        $log(true, null, $reply);

        return $result;
    }

    /** The first {...} in $content, so code fences or stray text around it don't matter. */
    public static function extractJson(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        $data = $start !== false && $end > $start ? json_decode(substr($content, $start, $end - $start + 1), true) : null;

        return is_array($data) ? $data : null;
    }

    /** @throws AiCapReached */
    private function ensureWithinCaps(): void
    {
        $userCap = config('ai.caps.user_daily');
        $schoolCap = config('ai.caps.school_daily');

        if ($userCap !== null && ($userId = auth()->id()) && AiUsage::todayCount('user_id', $userId) >= (int) $userCap) {
            throw new AiCapReached('user');
        }

        if ($schoolCap !== null && ($schoolId = $this->schoolId()) && AiUsage::todayCount('school_id', $schoolId) >= (int) $schoolCap) {
            throw new AiCapReached('school');
        }

        $this->ensureWithinDemoCap();
    }

    /**
     * A demo deployment (docs/demo-sandboxes.md): ai_usage lives in each
     * visitor's own copy, so a new copy starts at zero. The total across
     * all of them is counted in the file cache, outside every copy.
     *
     * @throws AiCapReached
     */
    private function ensureWithinDemoCap(): void
    {
        $cap = config('demo.ai_daily_cap');

        if (! config('demo.enabled') || $cap === null) {
            return;
        }

        $store = Cache::store('file');
        $key = 'demo-ai-calls:'.now()->toDateString();
        $store->add($key, 0, now()->endOfDay());

        if ((int) $store->get($key) >= (int) $cap) {
            throw new AiCapReached('demo');
        }

        $store->increment($key);
    }

    /**
     * The school a call counts against: the signed-in user's current one.
     * A guest (the landing page) has a school context too — the default
     * school ResolveSchool picks for public pages — which mustn't pay for it.
     */
    private function schoolId(): ?int
    {
        return auth()->check() && $this->context->has() ? $this->context->id() : null;
    }

    private function log(string $feature, int $started, bool $ok, ?string $error, array $reply): void
    {
        AiUsage::create([
            'user_id' => auth()->id(),
            'school_id' => $this->schoolId(),
            'feature' => $feature,
            'model' => $reply['model'] ?? config('services.openrouter.model'),
            'prompt_tokens' => data_get($reply, 'usage.prompt_tokens'),
            'completion_tokens' => data_get($reply, 'usage.completion_tokens'),
            'duration_ms' => (int) ((hrtime(true) - $started) / 1_000_000),
            'ok' => $ok,
            'error' => $error,
        ]);
    }
}
