import type { NextRequest, NextResponse } from "next/server";

/**
 * Public demo deployment (backend docs/demo-sandboxes.md): each visitor
 * gets a random id, kept in an httpOnly cookie and sent to Laravel as
 * X-Demo-Sandbox by the BFF, and Laravel runs their requests on their own
 * copy of the demo data. Must match the backend's DEMO_MODE. Server only.
 */
export const DEMO_SANDBOXES = process.env.DEMO_SANDBOXES === "true";

export const SANDBOX_COOKIE = "demo_sandbox";

export const SANDBOX_HEADER = "X-Demo-Sandbox";

const SANDBOX_ID = /^[a-f0-9]{32}$/;

/** The visitor's sandbox id: theirs, or a new one. Null when sandboxes are off. */
export function sandboxFor(request: NextRequest): { id: string; isNew: boolean } | null {
  if (!DEMO_SANDBOXES) return null;

  const existing = request.cookies.get(SANDBOX_COOKIE)?.value;
  if (existing && SANDBOX_ID.test(existing)) return { id: existing, isNew: false };

  return { id: crypto.randomUUID().replaceAll("-", ""), isNew: true };
}

/**
 * Stores a new id. Set by the page proxy on the first page view, so the
 * page's API calls, which start together, all carry the same id; the BFF
 * sets it too for a visitor whose first request is an API call.
 *
 * Kept for a week: the backend deletes the copy itself once it's idle,
 * and a returning visitor gets a fresh one under the same id.
 */
export function rememberSandbox(response: NextResponse, sandbox: { id: string; isNew: boolean } | null): NextResponse {
  if (sandbox?.isNew) {
    response.cookies.set(SANDBOX_COOKIE, sandbox.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return response;
}
