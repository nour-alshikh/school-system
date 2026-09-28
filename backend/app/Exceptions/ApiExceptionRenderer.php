<?php

namespace App\Exceptions;

use App\Tenancy\MissingSchoolContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Exceptions\UnauthorizedException as PermissionUnauthorizedException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Maps any exception raised on the API surface to one consistent JSON shape:
 *
 *   { "message": string, "errors"?: { [field]: string[] } }
 *
 * so frontend error handling (ApiError in frontend/src/lib/api.ts) can rely on
 * `message` and optionally `errors` always being there, regardless of which
 * layer actually threw.
 */
class ApiExceptionRenderer
{
    public function render(Throwable $e): JsonResponse
    {
        return match (true) {
            $e instanceof ValidationException => $this->validation($e),
            $e instanceof AuthenticationException => $this->json(__('api.unauthenticated'), 401),
            $e instanceof AuthorizationException => $this->json($e->getMessage() ?: __('api.unauthorized'), 403),
            $e instanceof PermissionUnauthorizedException => $this->json($e->getMessage(), 403),
            $e instanceof ModelNotFoundException => $this->json(__('api.not_found'), 404),
            $e instanceof NotFoundHttpException => $this->json(__('api.not_found'), 404),
            // A signed-in account with no school (plain registered user)
            // reaching school-owned data. Outside a request this is a bug and
            // stays a 500 — see TenantContext.
            $e instanceof MissingSchoolContext && request()->user() !== null => $this->json(__('api.no_school'), 403),
            $e instanceof ThrottleRequestsException => $this->json(__('api.too_many_requests'), 429, $e->getHeaders()),
            $e instanceof HttpExceptionInterface => $this->json($e->getMessage() ?: __('api.request_failed'), $e->getStatusCode(), $e->getHeaders()),
            default => $this->serverError($e),
        };
    }

    private function validation(ValidationException $e): JsonResponse
    {
        return $this->json($e->getMessage(), $e->status, [], ['errors' => $e->errors()]);
    }

    private function serverError(Throwable $e): JsonResponse
    {
        // Always logged, regardless of APP_DEBUG — that only controls what the
        // *client* sees, not what ends up in storage/logs/laravel.log.
        Log::error($e->getMessage(), ['exception' => $e]);

        if (! config('app.debug')) {
            return $this->json(__('api.server_error'), 500);
        }

        return $this->json($e->getMessage(), 500, [], [
            'debug' => [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => explode("\n", $e->getTraceAsString()),
            ],
        ]);
    }

    private function json(string $message, int $status, array $headers = [], array $extra = []): JsonResponse
    {
        return response()->json(['message' => $message, ...$extra], $status, $headers);
    }
}
