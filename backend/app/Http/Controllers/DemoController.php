<?php

namespace App\Http\Controllers;

use App\Demo\Sandboxes;
use App\Http\Middleware\UseDemoSandbox;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** A demo deployment's visitor-facing switches (docs/demo-sandboxes.md). */
class DemoController extends Controller
{
    /**
     * Throws away the visitor's copy of the demo data. Their next request
     * gets a fresh one; the sign-in went with the old copy, so the BFF
     * clears its cookies too.
     */
    public function reset(Request $request, Sandboxes $sandboxes): JsonResponse
    {
        abort_unless(config('demo.enabled'), 404);

        DB::disconnect();
        $sandboxes->delete((string) $request->headers->get(UseDemoSandbox::HEADER));

        return response()->json(['message' => __('api.demo_reset')]);
    }
}
