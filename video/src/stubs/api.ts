// The video never talks to the Laravel API. Anything that tries fails loudly.
export class ApiError extends Error {
  constructor(message: string, public status = 0, public errors: Record<string, string[]> = {}) {
    super(message);
  }
}
export async function apiFetch(path: string): Promise<never> {
  throw new ApiError(`apiFetch(${path}) called in the promo video; feed mock data instead.`);
}
