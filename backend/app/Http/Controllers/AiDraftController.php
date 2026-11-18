<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithAiDraft;
use App\Services\Ai\AiAccess;
use App\Services\Ai\Drafts;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/**
 * "Draft with AI" on a school's forms (docs/ai-assistant-plan.md, phase 1).
 * The kind decides the prompt, the shape and who may use it; the draft
 * comes back for the form to fill in — nothing is saved.
 */
class AiDraftController extends Controller
{
    use RespondsWithAiDraft;

    public function store(Request $request, string $kind, Drafts $drafts, AiAccess $access, TenantContext $context): JsonResponse
    {
        $drafter = $drafts->find($kind) ?? abort(404);

        if ($refusal = $access->refusal($context->has() ? $context->school() : null)) {
            abort($refusal[0], __($refusal[1]));
        }

        abort_unless($drafter->authorize($request->user()), 403);

        // A form whose module the plan leaves out can't be drafted for either.
        $feature = $drafter->planFeature();
        abort_if($feature && ! $context->school()->effectivePlan()->includes($feature), 403, __('api.plan_feature_missing'));

        // Drafts built from the school's records follow the assistant's data setting (phase 7).
        abort_if($drafter->readsSchoolData() && ! $access->readsData($context->school()), 403, __('api.ai_school_data_off'));

        $contextRules = collect($drafter->contextRules())->mapWithKeys(fn ($rules, $key) => ["context.{$key}" => $rules])->all();
        $data = $request->validate([
            'notes' => [$drafter->notesRequired() ? 'required' : 'nullable', 'string', 'max:2000'],
            'context' => ['nullable', 'array'],
            ...$contextRules,
        ]);

        // Only the keys the kind validates reach its prompt.
        $draftContext = Arr::only($data['context'] ?? [], array_keys($drafter->contextRules()));

        abort_unless($drafter->authorizeContext($request->user(), $draftContext), 403);

        return $this->aiDraft(fn () => $drafter->draft(trim($data['notes'] ?? ''), $draftContext));
    }
}
