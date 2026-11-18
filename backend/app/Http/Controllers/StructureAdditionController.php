<?php

namespace App\Http\Controllers;

use App\Services\StructureAdditions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * Confirming the assistant's "set up structure" card
 * (docs/ai-assistant-plan.md, phase 6): adds the stages, grades,
 * classrooms and subjects that don't exist yet, matched by name at the
 * time of saving, and skips the rest. manage-academics, like adding each
 * one by hand.
 */
class StructureAdditionController extends Controller
{
    public function store(Request $request, StructureAdditions $structure): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'additions' => ['required', 'array'],
            ...StructureAdditions::rules('additions.'),
        ]);
        $validator->after(StructureAdditions::after('additions.'));
        $additions = $validator->validate()['additions'];

        return response()->json(['added' => $structure->apply($additions)], 201);
    }
}
