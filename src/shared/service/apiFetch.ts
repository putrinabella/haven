type ExtendedRequestInit = RequestInit & {
  next?: NextFetchRequestConfig;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, options?: ExtendedRequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  // Error responses (502 pages, 204, proxies) are not always JSON — never let parsing mask the status.
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(json?.meta?.message || json?.error || `Request failed (${res.status})`, res.status);
  }

  return json as T;
}
