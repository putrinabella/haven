import { test } from "node:test";
import assert from "node:assert/strict";
import { isForeignKeyViolation, runPurge } from "./purge-core.ts";

const fk = () => Object.assign(new Error("violates foreign key"), { code: "23503" });
const entries = ["comments", "posts", "categories"].map((name) => ({ name, table: name }));

test("detects FK violations, including wrapped causes", () => {
  assert.ok(isForeignKeyViolation(fk()));
  assert.ok(isForeignKeyViolation(new Error("Failed query", { cause: fk() })));
  assert.ok(!isForeignKeyViolation(new Error("boom")));
  assert.ok(!isForeignKeyViolation(Object.assign(new Error("x"), { code: "23505" })));
  assert.ok(!isForeignKeyViolation(null));
});

test("purges in the given order and reports counts", async () => {
  const order: string[] = [];
  const report = await runPurge(entries, async (e) => {
    order.push(e.name);
    return e.name.length;
  });
  assert.deepEqual(order, ["comments", "posts", "categories"]);
  assert.deepEqual(report.purged, { comments: 8, posts: 5, categories: 10 });
  assert.deepEqual(report.blocked, []);
});

test("a table still referenced by live rows is reported as blocked and does not abort the rest", async () => {
  const report = await runPurge(entries, async (e) => {
    if (e.name === "posts") throw fk();
    return 1;
  });
  assert.deepEqual(report.purged, { comments: 1, categories: 1 });
  assert.equal(report.blocked.length, 1);
  assert.equal(report.blocked[0].table, "posts");
});

test("unexpected errors are rethrown, never swallowed", async () => {
  await assert.rejects(
    runPurge(entries, async () => {
      throw new Error("connection lost");
    }),
    /connection lost/,
  );
});

test("an empty registry is a no-op", async () => {
  assert.deepEqual(await runPurge([], async () => 1), { purged: {}, blocked: [] });
});
