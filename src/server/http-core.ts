// Pure HTTP helpers for the API layer (no framework, no zod): unit-testable in plain Node.
import type { ApiResponse, PaginatedMeta } from "../shared/types/common.ts";

export const MAX_BODY_BYTES = 1_000_000;

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const isUnsafeMethod = (method: string): boolean => UNSAFE_METHODS.has(method.toUpperCase());

/**
 * CSRF defense for cookie-authenticated, state-changing requests (defense in depth on top of
 * SameSite cookies). Browsers always attach Origin to cross-origin and same-origin unsafe requests
 * and page scripts cannot forge it, so Origin must match the host being served.
 * Falls back to Sec-Fetch-Site; with neither header the request is refused.
 */
export function isSameOrigin(headers: Headers): boolean {
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const origin = headers.get("origin");
  if (origin) {
    try {
      return host !== null && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  const site = headers.get("sec-fetch-site");
  return site === "same-origin" || site === "none";
}

/**
 * Client IP for rate limiting anonymous traffic. Only trustworthy behind a proxy that sets/overwrites
 * X-Forwarded-For (Vercel does); never use it for authorization decisions.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export const paginationMeta = (total: number, page: number, size: number): PaginatedMeta => ({
  page,
  size,
  total,
  totalPages: Math.max(1, Math.ceil(total / size)),
});

export function okBody<T>(data: T, requestId: string, code = 200, message = "OK"): ApiResponse<T> {
  return { meta: { success: true, code, message, requestId }, data };
}

export function errorBody(
  status: number,
  errorCode: string,
  message: string,
  requestId: string,
  fieldErrors?: Record<string, string[]>,
): ApiResponse<null> {
  return {
    meta: { success: false, code: status, message, requestId, errorCode },
    data: null,
    ...(fieldErrors ? { errors: { fieldErrors } } : {}),
  };
}
