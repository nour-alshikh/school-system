<?php

namespace App\Services\Ai\Assistant\Actions;

use App\Services\Ai\AiCapReached;
use App\Services\Ai\Assistant\Action;
use App\Services\Ai\Assistant\ToolContext;
use App\Services\Ai\Drafts\StructureAdditionsDrafter;
use App\Services\StructureAdditions;
use RuntimeException;

/**
 * "Add a secondary stage with 3 classes per grade" → what would be added
 * to the structure, to confirm (POST /api/structure/additions). Preparing
 * it takes a second AI call (StructureAdditionsDrafter) with the current
 * structure's names; whatever already exists is skipped, nothing is
 * renamed or removed.
 */
class SetUpStructure extends Action
{
    public function __construct(
        private readonly StructureAdditionsDrafter $drafter,
        private readonly StructureAdditions $structure,
    ) {}

    public function name(): string
    {
        return 'set_up_structure';
    }

    public function describe(): string
    {
        return 'set_up_structure(request: string) — add stages, grades, classrooms or subjects to the school\'s structure, e.g. "add a secondary stage with 3 classes per grade" or "add a classroom C to every primary grade". Pass the request in the person\'s words. It only adds; it can\'t rename or remove.';
    }

    public function allows(ToolContext $context): bool
    {
        return $context->can('manage-academics');
    }

    public function rules(): array
    {
        return ['request' => ['required', 'string', 'max:1000']];
    }

    public function prepare(ToolContext $context, array $fields): array
    {
        try {
            $additions = $this->drafter->draft(trim($fields['request']));
        } catch (AiCapReached $e) {
            throw $e;
        } catch (RuntimeException $e) {
            report($e);

            return ['error' => 'The structure couldn\'t be drafted.'];
        }

        $plan = $this->structure->plan($additions);
        if (array_sum($plan['counts']) === 0) {
            return ['error' => 'Everything asked for already exists.'];
        }

        return [
            'fields' => [
                'request' => trim($fields['request']),
                'additions' => $additions,
                'preview' => collect($plan)->except('skipped')->all(),
            ],
            'warnings' => $plan['skipped'] > 0 ? ['structure_existing_skipped'] : [],
        ];
    }
}
