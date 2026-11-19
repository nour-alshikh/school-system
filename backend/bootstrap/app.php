<?php

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\AuditPlatformSession;
use App\Http\Middleware\EnforcePlanFeatures;
use App\Http\Middleware\EnsurePlatformAdmin;
use App\Http\Middleware\ResolveSchool;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\TrustBffClientIp;
use App\Http\Middleware\UseDemoSandbox;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // First of all, so throttles and logs see the visitor's address, not the BFF's.
        // Then, on a demo deployment, the visitor's own copy of the data,
        // before anything touches the database (docs/demo-sandboxes.md).
        $middleware->prepend([TrustBffClientIp::class, UseDemoSandbox::class]);
        $middleware->statefulApi();
        $middleware->throttleApi();
        // AuditPlatformSession records what a system admin does inside a school.
        // EnforcePlanFeatures turns away modules the school's plan doesn't include.
        $middleware->api(append: [SetLocale::class, AuditPlatformSession::class, EnforcePlanFeatures::class]);
        // Prepended so the school is set before route-model binding
        // (SubstituteBindings) resolves school-scoped models.
        $middleware->api(prepend: [ResolveSchool::class]);

        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
            'platform-admin' => EnsurePlatformAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') || $request->wantsJson()) {
                return app(ApiExceptionRenderer::class)->render($e);
            }
        });
    })->create();
