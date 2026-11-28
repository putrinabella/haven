// Pure helpers (no React, no I/O) so they can be unit-tested and used anywhere.
export const RETURN_TO_PARAM = "returnTo";
const MAX_LENGTH = 2000;

/**
 * Accepts only same-origin relative paths ("/items?q=a"). Rejects absolute URLs, protocol-relative
 * ("//evil.com"), backslash tricks ("/\evil.com") and control characters, so `?returnTo=` can never
 * become an open redirect.
 */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://placeholder.invalid");
    if (url.origin !== "http://placeholder.invalid") return fallback;
  } catch {
    return fallback;
  }
  return value;
}

/** Appends ?returnTo=<current list URL> to a detail link, so "back" can restore the exact list state. */
export function withReturnTo(href: string, currentPath: string, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch.replace(/^\?/, ""));
  params.delete(RETURN_TO_PARAM);
  const query = params.toString();
  const current = query ? `${currentPath}?${query}` : currentPath;
  return `${href}${href.includes("?") ? "&" : "?"}${RETURN_TO_PARAM}=${encodeURIComponent(current)}`;
}
