import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIp, errorBody, isSameOrigin, isUnsafeMethod, okBody, paginationMeta } from "./http-core.ts";

const h = (o: Record<string, string>) => new Headers(o);

test("same-origin check: matching Origin passes, foreign or malformed Origin fails", () => {
  assert.ok(isSameOrigin(h({ origin: "https://haven.app", host: "haven.app" })));
  assert.ok(isSameOrigin(h({ origin: "https://haven.app", "x-forwarded-host": "haven.app", host: "internal:3000" })));
  assert.ok(!isSameOrigin(h({ origin: "https://evil.com", host: "haven.app" })));
  assert.ok(!isSameOrigin(h({ origin: "https://haven.app.evil.com", host: "haven.app" })));
  assert.ok(!isSameOrigin(h({ origin: "not a url", host: "haven.app" })));
  assert.ok(!isSameOrigin(h({ origin: "null", host: "haven.app" })));
});

test("without Origin, Sec-Fetch-Site decides; with neither, refuse", () => {
  assert.ok(isSameOrigin(h({ "sec-fetch-site": "same-origin", host: "x" })));
  assert.ok(!isSameOrigin(h({ "sec-fetch-site": "cross-site", host: "x" })));
  assert.ok(!isSameOrigin(h({ host: "x" })));
});

test("unsafe methods", () => {
  for (const m of ["POST", "put", "PATCH", "DELETE"]) assert.ok(isUnsafeMethod(m));
  for (const m of ["GET", "HEAD", "OPTIONS"]) assert.ok(!isUnsafeMethod(m));
});

test("client ip uses the first forwarded hop, then x-real-ip, then unknown", () => {
  assert.equal(clientIp(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })), "1.2.3.4");
  assert.equal(clientIp(h({ "x-real-ip": "5.6.7.8" })), "5.6.7.8");
  assert.equal(clientIp(h({})), "unknown");
});

test("pagination meta never reports fewer than one page", () => {
  assert.deepEqual(paginationMeta(0, 1, 15), { page: 1, size: 15, total: 0, totalPages: 1 });
  assert.deepEqual(paginationMeta(31, 2, 15), { page: 2, size: 15, total: 31, totalPages: 3 });
});

test("envelopes carry the request id; errors include a stable code and optional field errors", () => {
  const ok = okBody({ a: 1 }, "rid-1");
  assert.deepEqual(ok, { meta: { success: true, code: 200, message: "OK", requestId: "rid-1" }, data: { a: 1 } });
  const err = errorBody(422, "validation_failed", "Invalid", "rid-2", { name: ["Required"] });
  assert.equal(err.meta.errorCode, "validation_failed");
  assert.equal(err.data, null);
  assert.deepEqual(err.errors, { fieldErrors: { name: ["Required"] } });
  assert.equal("errors" in errorBody(500, "internal_error", "x", "r"), false);
});
