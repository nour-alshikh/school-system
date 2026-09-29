<?php

namespace App\Providers;

use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Tenancy\QueueTenancy;
use App\Tenancy\SchoolScopedPresenceVerifier;
use App\Tenancy\TenantContext;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\Sanctum;
use Spatie\Translatable\Translatable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Scoped, not singleton: reset between queue jobs so one job's
        // school can't leak into the next. See docs/multi-tenancy.md.
        $this->app->scoped(TenantContext::class);

        $this->app->extend('validation.presence', fn ($verifier, $app) => new SchoolScopedPresenceVerifier($app['db']));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Carries the membership each token was issued for (see ResolveSchool).
        Sanctum::usePersonalAccessTokenModel(PersonalAccessToken::class);

        // Queued jobs run as the school that dispatched them.
        QueueTenancy::register();

        ResetPassword::createUrlUsing(function ($notifiable, string $token) {
            $frontendUrl = rtrim(config('cors.allowed_origins')[0] ?? 'http://localhost:3000', '/');
            // The frontend's locale-prefixed routing (localePrefix: "always")
            // requires every page URL to start with /en or /ar — this request's
            // locale was set by SetLocale from the Accept-Language the BFF
            // forwarded, so it matches whatever the user was actually using.
            $locale = app()->getLocale();

            return "{$frontendUrl}/{$locale}/reset-password?token={$token}&email={$notifiable->getEmailForPasswordReset()}";
        });

        // Posts store title/body as {locale => text} (see Post::$translatable);
        // a post that was only ever written in one language should still show
        // that content when browsed in the other, instead of coming back blank.
        app(Translatable::class)->fallback(
            fallbackLocale: config('app.fallback_locale'),
            fallbackAny: true,
        );

        // General ceiling for the whole API surface (bootstrap/app.php's
        // throttleApi() wires this in as the 'api' middleware group's default).
        // Sensitive endpoints (register/login/forgot-password) additionally
        // carry their own tighter throttle:10,1 on top of this.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Creating a school is open to anyone, so it's tighter than login:
        // a few per hour from one address (docs/self-service-schools-plan.md).
        // Only schools actually created count — a form resubmitted after a
        // validation error (slug taken, weak password) doesn't use one up;
        // the general 'api' limit above still caps raw request volume.
        RateLimiter::for('school-signup', function (Request $request) {
            $created = fn ($response) => $response->status() === 201;

            return [
                Limit::perHour(3)->by('hour:'.$request->ip())->after($created),
                Limit::perDay(10)->by('day:'.$request->ip())->after($created),
            ];
        });

        // Admins bypass every Policy check (see app/Policies) without each
        // policy needing to special-case the admin role individually.
        Gate::before(function (User $user, string $ability) {
            return $user->hasRole('admin') ? true : null;
        });
    }
}
