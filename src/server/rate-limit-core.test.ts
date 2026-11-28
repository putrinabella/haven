import { test } from "node:test";
import assert from "node:assert/strict";
import { assertValidConfig, buildKey, evaluate } from "./rate-limit-core.ts";

const cfg = { limit: 3, windowSeconds: 60 };

test("allows up to the limit and blocks the next call", () => {
  assert.equal(evaluate(1, cfg, 1000, 1010).allowed, true);
  assert.equal(evaluate(3, cfg, 1000, 1010).allowed, true);
  assert.equal(evaluate(3, cfg, 1000, 1010).remaining, 0);
  assert.equal(evaluate(4, cfg, 1000, 1010).allowed, false);
});

test("retryAfter is time left in the window and never below 1s", () => {
  assert.equal(evaluate(4, cfg, 1000, 1010).retryAfterSeconds, 50);
  assert.equal(evaluate(4, cfg, 1000, 1059.9).retryAfterSeconds, 1);
  assert.equal(evaluate(4, cfg, 1000, 1100).retryAfterSeconds, 1);
});

test("keys are namespaced, deterministic, hashed and bounded", () => {
  const a = buildKey("action:createX", "user-123");
  assert.equal(a, buildKey("action:createX", "user-123"));
  assert.notEqual(a, buildKey("action:createY", "user-123"));
  assert.notEqual(a, buildKey("action:createX", "user-124"));
  assert.ok(!a.includes("user-123"), "raw subject must not appear in the key");
  assert.ok(a.length <= 80);
});

test("config validation rejects non-integers, zero, negatives and oversized windows", () => {
  assert.doesNotThrow(() => assertValidConfig({ limit: 1, windowSeconds: 1 }));
  assert.doesNotThrow(() => assertValidConfig({ limit: 5, windowSeconds: 86_400 }));
  for (const bad of [
    { limit: 0, windowSeconds: 60 },
    { limit: 1.5, windowSeconds: 60 },
    { limit: 5, windowSeconds: 0 },
    { limit: 5, windowSeconds: 86_401 },
    { limit: 5, windowSeconds: Number.NaN },
    { limit: 5, windowSeconds: "60; DROP TABLE x" as unknown as number },
  ]) {
    assert.throws(() => assertValidConfig(bad), RangeError);
  }
});
