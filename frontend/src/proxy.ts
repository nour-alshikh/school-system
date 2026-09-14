import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

// Laravel's session cookie is set on every request, authenticated or not —
// it can't tell "logged in" from "just visited the site". AuthController
// queues this separate marker cookie only on login/register and clears it
// on logout, so that's what actually reflects auth state here.
const AUTH_STATUS_COOKIE =
  process.env.NEXT_PUBLIC_AUTH_STATUS_COOKIE ?? "auth_status";

const PROTECTED_PATHS = ["/dashboard", "/admin"];
// Reset links are token-authenticated and independent of the current session,
// so /reset-password is intentionally not guest-only — a logged-in user should
// still be able to use a reset link mailed to them.
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"];

function splitLocale(pathname: string): { locale: string; rest: string } | null {
  const locale = routing.locales.find(
    (candidate) =>
      pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`)
  );
  if (!locale) return null;

  const rest = pathname.slice(`/${locale}`.length) || "/";
  return { locale, rest };
}

export function proxy(request: NextRequest) {
  // Handles locale detection, the "always" prefix redirect, and the
  // NEXT_LOCALE cookie — runs first so every path below already has its
  // locale segment resolved (or is being redirected to get one).
  const intlResponse = handleI18nRouting(request);

  const split = splitLocale(request.nextUrl.pathname);
  if (!split) return intlResponse;

  const { locale, rest } = split;
  const hasSession = request.cookies.has(AUTH_STATUS_COOKIE);

  const isProtected = PROTECTED_PATHS.some(
    (path) => rest === path || rest.startsWith(`${path}/`)
  );
  const isGuestOnly = GUEST_ONLY_PATHS.some(
    (path) => rest === path || rest.startsWith(`${path}/`)
  );

  if (isProtected && !hasSession) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuestOnly && hasSession) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals, and files with an
    // extension (static assets) — next-intl needs to see page requests to
    // add/validate the locale prefix.
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
