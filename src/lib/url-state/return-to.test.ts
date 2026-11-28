import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo, withReturnTo } from "./return-to.ts";

test("accepts same-origin relative paths with query", () => {
  assert.equal(safeReturnTo("/items?q=rice&page=2", "/"), "/items?q=rice&page=2");
});

test("rejects open-redirect and malformed values, falling back", () => {
  for (const bad of [
    "https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "javascript:alert(1)",
    "items", "", null, undefined, "/ok\nhttps://evil.com", "/" + "a".repeat(2001),
  ]) {
    assert.equal(safeReturnTo(bad as string | null | undefined, "/fallback"), "/fallback", String(bad));
  }
});

test("withReturnTo encodes the current list URL and round-trips through safeReturnTo", () => {
  const href = withReturnTo("/items/42", "/items", "q=a%26b&page=3");
  const value = new URL(href, "http://x").searchParams.get("returnTo");
  assert.equal(value, "/items?q=a%26b&page=3");
  assert.equal(safeReturnTo(value, "/"), value);
});

test("withReturnTo handles no filters, existing query, and never nests returnTo", () => {
  assert.equal(withReturnTo("/items/42", "/items", ""), "/items/42?returnTo=%2Fitems");
  assert.ok(withReturnTo("/items/42?tab=1", "/items", "").startsWith("/items/42?tab=1&returnTo="));
  const nested = withReturnTo("/items/42", "/items", "q=a&returnTo=%2Fold");
  assert.equal(new URL(nested, "http://x").searchParams.get("returnTo"), "/items?q=a");
});
