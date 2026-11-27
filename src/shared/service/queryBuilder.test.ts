import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueryString } from "./queryBuilder.ts";

test("returns empty string for no params", () => {
  assert.equal(buildQueryString(), "");
  assert.equal(buildQueryString({}), "");
});

test("skips undefined, null and empty values but keeps 0 and false", () => {
  assert.equal(buildQueryString({ a: undefined, b: null, c: "", d: 0, e: false }), "?d=0&e=false");
});

test("encodes special characters", () => {
  assert.equal(buildQueryString({ q: "a&b=c d" }), "?q=a%26b%3Dc+d");
});
