import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// This is the whole BFF: the browser only ever talks to this same-origin
// route, never to Laravel directly. That's what makes auth work when the
// frontend and backend live on unrelated domains (Vercel + reeras.site) —
// a session cookie scoped to the Laravel domain can't be sent cross-site,
// so instead Laravel issues a Sanctum personal access token on login, this
// route stores it in an httpOnly cookie scoped to *this* domain, and every
// other request gets it replayed as a Bearer header server-side. The token
// itself never reaches browser JS.
const LARAVEL_API_URL = process.env.LARAVEL_API_URL ?? "http://localhost:8000";
const TOKEN_COOKIE = "sanctum_token";
// While a system admin is inside a school (central dashboard, phase 5), the
// active token is that session's, and their platform token waits here to
// come back to — on exit, or when the session ends or expires.
const PLATFORM_TOKEN_COOKIE = "sanctum_platform_token";
const AUTH_STATUS_COOKIE =
  process.env.NEXT_PUBLIC_AUTH_STATUS_COOKIE ?? "auth_status";
// Proves to Laravel that X-Client-IP came from here (TrustBffClientIp), so
// its per-address limits see each visitor instead of this server. Server
// only: never NEXT_PUBLIC_. Unset: no address is passed on.
const BFF_SHARED_SECRET = process.env.BFF_SHARED_SECRET;

/**
 * The visitor's address. Vercel sets x-real-ip and x-forwarded-for itself
 * (overwriting what the browser sent), so they can be trusted there; the
 * first x-forwarded-for entry is the client.
 */
function clientIp(request: NextRequest): string | null {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0];
  return ip?.trim() || null;
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
};

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const pathname = path.join("/");
  const targetUrl = new URL(
    `/api/${pathname}${request.nextUrl.search}`,
    LARAVEL_API_URL
  );

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  const headers = new Headers();
  headers.set("Accept", "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const ip = clientIp(request);
  if (BFF_SHARED_SECRET && ip) {
    headers.set("X-Client-IP", ip);
    headers.set("X-BFF-Secret", BFF_SHARED_SECRET);
  }

  // Set by the next-intl proxy from the active locale segment — forwarded so
  // Laravel returns validation/error messages in the same language.
  const locale = request.cookies.get("NEXT_LOCALE")?.value;
  if (locale) headers.set("Accept-Language", locale);

  const laravelResponse = await fetch(targetUrl, {
    method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  // switch-school answers like login: a new token (bound to another school)
  // that replaces the cookie. So do the two ways of creating a school
  // (school-signup for a guest, POST schools for a signed-in user): the
  // token is bound to the new school.
  if (
    pathname === "login" ||
    pathname === "login/two-factor" ||
    pathname === "register" ||
    pathname === "switch-school" ||
    pathname === "school-signup" ||
    (pathname === "schools" && method === "POST")
  ) {
    return handleAuthResponse(laravelResponse);
  }

  const platformToken = request.cookies.get(PLATFORM_TOKEN_COOKIE)?.value;

  if (method === "POST" && /^platform\/schools\/\d+\/enter$/.test(pathname)) {
    return handleEnterSchool(laravelResponse, token);
  }

  if (pathname === "platform/exit") {
    return handleExitSchool(laravelResponse, platformToken);
  }

  if (pathname === "logout") {
    // Signing out of a school session signs out of the platform too.
    if (platformToken) {
      await fetch(new URL("/api/logout", LARAVEL_API_URL), {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${platformToken}` },
      }).catch(() => undefined);
    }
    return handleLogout(laravelResponse);
  }

  // The school session ended (expired, or the system admin lost access):
  // fall back to the platform token. A read is retried with it, so the
  // page gets the platform user instead of a sign-out.
  if (laravelResponse.status === 401 && platformToken && token !== platformToken) {
    const retried =
      method === "GET"
        ? await fetch(targetUrl, {
            headers: { ...Object.fromEntries(headers), Authorization: `Bearer ${platformToken}` },
          })
        : laravelResponse;
    const response = await passThrough(retried);
    response.cookies.set(TOKEN_COOKIE, platformToken, COOKIE_OPTIONS);
    response.cookies.delete(PLATFORM_TOKEN_COOKIE);
    return response;
  }

  return passThrough(laravelResponse);
}

async function passThrough(laravelResponse: Response): Promise<NextResponse> {
  const body = await laravelResponse.arrayBuffer();

  // A 204/205/304 response must have a null body per the Fetch spec — an
  // empty ArrayBuffer still counts as "has a body" and throws constructing
  // the Response, which was surfacing as a 500 (and a misleading "Request
  // failed" toast) on every successful delete, even though Laravel's
  // response()->noContent() had already done its job.
  const NULL_BODY_STATUSES = new Set([204, 205, 304]);
  const responseBody = NULL_BODY_STATUSES.has(laravelResponse.status)
    ? null
    : body;

  const responseHeaders = new Headers({
    "Content-Type":
      laravelResponse.headers.get("content-type") ?? "application/json",
  });
  // Files (e.g. student attachments, served only through the API) need
  // their file name for downloads and must stay out of shared caches.
  for (const name of ["content-disposition", "cache-control"]) {
    const value = laravelResponse.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new NextResponse(responseBody, {
    status: laravelResponse.status,
    headers: responseHeaders,
  });
}

async function handleAuthResponse(laravelResponse: Response): Promise<NextResponse> {
  const data = await laravelResponse.json().catch(() => null);

  // Strip the token out of the body — it belongs in the httpOnly cookie
  // below, never in JS-readable JSON. Everything else passes through: a
  // failed login's `message`/`errors`, and the `schools` list when the
  // account has to pick which school to sign in to.
  const { token, ...rest } = data ?? {};
  const response = NextResponse.json(data ? rest : data, {
    status: laravelResponse.status,
  });

  if (laravelResponse.ok && token) {
    response.cookies.set(TOKEN_COOKIE, token, COOKIE_OPTIONS);
    response.cookies.set(AUTH_STATUS_COOKIE, "1", {
      ...COOKIE_OPTIONS,
      httpOnly: false,
    });
  }

  return response;
}

/** Like a login, but the platform token is kept aside to come back to. */
async function handleEnterSchool(laravelResponse: Response, platformToken: string | undefined): Promise<Response> {
  const response = await handleAuthResponse(laravelResponse);
  if (laravelResponse.ok && platformToken) {
    response.cookies.set(PLATFORM_TOKEN_COOKIE, platformToken, COOKIE_OPTIONS);
  }
  return response;
}

/** Back to the platform token, whatever the school session's answer was. */
async function handleExitSchool(laravelResponse: Response, platformToken: string | undefined): Promise<Response> {
  const status = laravelResponse.status === 401 ? 204 : laravelResponse.status;
  const response = new NextResponse(null, { status });
  if (platformToken) {
    response.cookies.set(TOKEN_COOKIE, platformToken, COOKIE_OPTIONS);
    response.cookies.delete(PLATFORM_TOKEN_COOKIE);
  }
  return response;
}

async function handleLogout(laravelResponse: Response): Promise<Response> {
  const response = new NextResponse(null, { status: laravelResponse.status });

  response.cookies.delete(TOKEN_COOKIE);
  response.cookies.delete(PLATFORM_TOKEN_COOKIE);
  response.cookies.delete(AUTH_STATUS_COOKIE);

  return response;
}

type RouteParams = { params: Promise<{ path: string[] }> };

async function handler(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
