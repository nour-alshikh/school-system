export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  /** The full response body, for endpoints that send more than message/errors. */
  data?: unknown;

  constructor(
    status: number,
    message: string,
    errors?: Record<string, string[]>,
    data?: unknown
  ) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const isFormData = options.body instanceof FormData;

  // Same-origin: this hits our own /api/* route handlers (see
  // src/app/api/[...path]/route.ts), which proxy to Laravel server-side.
  const response = await fetch(path, {
    ...options,
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      // Let the browser set Content-Type (with boundary) for FormData bodies.
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.message ?? "Request failed",
      data?.errors,
      data
    );
  }

  return data as T;
}
