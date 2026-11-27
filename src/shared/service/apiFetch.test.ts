import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiFetch, ApiError } from "./apiFetch.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const mockFetch = (res: Response) => {
  globalThis.fetch = (async () => res) as typeof fetch;
};

test("returns parsed JSON on success", async () => {
  mockFetch(Response.json({ data: 1 }));
  assert.deepEqual(await apiFetch("/x"), { data: 1 });
});

test("throws ApiError with server message and status", async () => {
  mockFetch(Response.json({ meta: { message: "nope" } }, { status: 403 }));
  await assert.rejects(apiFetch("/x"), (e: unknown) => e instanceof ApiError && e.status === 403 && e.message === "nope");
});

test("non-JSON error body (e.g. 502 HTML) still yields ApiError, not a SyntaxError", async () => {
  mockFetch(new Response("<html>bad gateway</html>", { status: 502 }));
  await assert.rejects(apiFetch("/x"), (e: unknown) => e instanceof ApiError && e.status === 502);
});
