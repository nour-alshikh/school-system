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
const AUTH_STATUS_COOKIE =
  process.env.NEXT_PUBLIC_AUTH_STATUS_COOKIE ?? "auth_status";

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
  // that replaces the cookie.
  if (
    pathname === "login" ||
    pathname === "register" ||
    pathname === "switch-school"
  ) {
    return handleAuthResponse(laravelResponse);
  }

  if (pathname === "logout") {
    return handleLogout(laravelResponse);
  }

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

  return new NextResponse(responseBody, {
    status: laravelResponse.status,
    headers: {
      "Content-Type":
        laravelResponse.headers.get("content-type") ?? "application/json",
    },
  });
}

async function handleAuthResponse(laravelResponse: Response): Promise<Response> {
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

async function handleLogout(laravelResponse: Response): Promise<Response> {
  const response = new NextResponse(null, { status: laravelResponse.status });

  response.cookies.delete(TOKEN_COOKIE);
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
