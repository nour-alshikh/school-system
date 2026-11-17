<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithAiDraft;
use App\Models\AssistantConversation;
use App\Services\Ai\AiAccess;
use App\Services\Ai\Assistant\Assistant;
use App\Tenancy\TenantContext;
use App\TypeScript\AssistantConversationType;
use App\TypeScript\AssistantMessageType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The in-app assistant (docs/ai-assistant-plan.md, phases 4–5), for every
 * signed-in user whose school has AI available. Chats belong to the user at
 * the current school and are kept 30 days (assistant:prune).
 */
class AssistantController extends Controller
{
    use RespondsWithAiDraft;

    /** A path inside the app: "/attendance/history". */
    private const PATH = 'regex:#^/[A-Za-z0-9/_\-]*$#';

    public function __construct(private readonly AiAccess $access, private readonly TenantContext $context) {}

    /** The latest conversation, to carry on with; null when there's none from the last 30 days. */
    public function show(Request $request): JsonResponse
    {
        $this->ensureAvailable();

        $conversation = AssistantConversation::ownedBy($request->user())
            ->latest('updated_at')->latest('id')
            ->with('messages')
            ->first();

        return response()->json([
            'conversation' => $conversation ? AssistantConversationType::fromModel($conversation) : null,
            // Whether answers can use school data (the assistant_data setting).
            'reads_data' => $this->access->readsData($this->context->school()),
        ]);
    }

    public function store(Request $request, Assistant $assistant): JsonResponse
    {
        $this->ensureAvailable();

        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'conversation_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'string', 'max:200', self::PATH],
            // The pages this user can open, from their navigation: what
            // answers may link to. Only ever used as links, so a client
            // sending others gains nothing the URL bar doesn't give.
            'links' => ['nullable', 'array', 'max:80'],
            'links.*.href' => ['required', 'string', 'max:200', self::PATH],
            'links.*.label' => ['required', 'string', 'max:100'],
        ]);

        $conversation = isset($data['conversation_id'])
            ? AssistantConversation::ownedBy($request->user())->findOrFail($data['conversation_id'])
            : null;

        $links = array_map(fn ($link) => ['href' => $link['href'], 'label' => $link['label']], $data['links'] ?? []);

        $result = $this->aiCall(fn () => $assistant->ask(
            $request->user(),
            $this->context->school(),
            $conversation,
            trim($data['message']),
            $data['page'] ?? null,
            $links,
            app()->getLocale(),
            $this->access->readsData($this->context->school()),
        ), 'api.assistant_failed');

        return response()->json([
            'conversation_id' => $result['conversation']->id,
            'messages' => array_map(AssistantMessageType::fromModel(...), $result['messages']),
        ]);
    }

    /** "Clear history": every conversation this user has at this school. */
    public function destroy(Request $request): JsonResponse
    {
        // Works with AI switched off too: deleting what's kept is always allowed.
        abort_unless($this->context->has(), 403, __('api.no_current_school'));

        AssistantConversation::where('user_id', $request->user()->id)->delete();

        return response()->json(null, 204);
    }

    private function ensureAvailable(): void
    {
        if ($refusal = $this->access->refusal($this->context->has() ? $this->context->school() : null)) {
            abort($refusal[0], __($refusal[1]));
        }
    }
}
