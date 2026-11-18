<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Concerns\RespondsWithAiDraft;
use App\Http\Controllers\Controller;
use App\Services\Ai\AiAccess;
use App\Services\Ai\WeeklySummary;
use App\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;

/**
 * The admin dashboard's "This week" card (docs/ai-assistant-plan.md,
 * phase 7). The numbers always come back; the written summary only when
 * the school lets the assistant read its data, since the numbers go to the
 * AI provider to write it.
 */
class WeeklySummaryController extends Controller
{
    use RespondsWithAiDraft;

    public function show(WeeklySummary $summary, AiAccess $access, TenantContext $context): JsonResponse
    {
        $school = $context->school();
        $canWrite = $access->readsData($school);

        return response()->json([
            'facts' => $summary->facts($school),
            'summary' => $canWrite ? $summary->cached($school, app()->getLocale()) : null,
            'can_write' => $canWrite,
        ]);
    }

    public function store(WeeklySummary $summary, AiAccess $access, TenantContext $context): JsonResponse
    {
        $school = $context->school();

        if ($refusal = $access->refusal($school)) {
            abort($refusal[0], __($refusal[1]));
        }
        abort_unless($access->readsData($school), 403, __('api.ai_school_data_off'));

        $facts = $summary->facts($school);
        $written = $this->aiCall(fn () => $summary->write($school, app()->getLocale(), $facts), 'api.weekly_summary_failed');

        return response()->json(['facts' => $facts, 'summary' => $written, 'can_write' => true]);
    }
}
