import type { ApiResponse } from "../types/common";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export class ApiError extends Error {
  readonly status: number;
  /** Stable machine-readable code from the API envelope ("forbidden", "validation_failed", ...). */
  readonly code?: string;
  /** Quote this when reporting a problem; it matches the server log line. */
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, details: { code?: string; requestId?: string; fieldErrors?: Record<string, string[]> } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.fieldErrors = details.fieldErrors;
  }
}

/**
 * Browser-side fetch for the first-party /api/v1 endpoints (session cookie goes along automatically).
 * Server Components should query the database directly instead of calling their own API.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  // Error responses (502 pages, 204, proxies) are not always JSON: never let parsing mask the status.
  const json = (await res.json().catch(() => null)) as Partial<ApiResponse<unknown>> | null;

  if (!res.ok) {
    throw new ApiError(json?.meta?.message || `Request failed (${res.status})`, res.status, {
      code: json?.meta?.errorCode,
      requestId: json?.meta?.requestId,
      fieldErrors: json?.errors?.fieldErrors,
    });
  }

  return json as T;
}
