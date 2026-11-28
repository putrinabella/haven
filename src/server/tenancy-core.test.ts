import { test } from "node:test";
import assert from "node:assert/strict";
import { isUuid, pickHousehold, readCookie, roleAtLeast, serializeHouseholdCookie } from "./tenancy-core.ts";
import { ForbiddenError } from "./errors.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const memberships = [
  { householdId: A, role: "owner" as const },
  { householdId: B, role: "member" as const },
];

test("role hierarchy: owner > admin > member", () => {
  assert.ok(roleAtLeast("owner", "admin") && roleAtLeast("admin", "admin") && roleAtLeast("owner", "member"));
  assert.ok(!roleAtLeast("member", "admin") && !roleAtLeast("admin", "owner"));
});

test("uuid validation", () => {
  assert.ok(isUuid(A));
  for (const bad of ["", "abc", "1; DROP TABLE x", null, undefined, 5]) assert.ok(!isUuid(bad));
});

test("defaults to the oldest membership, honours a valid requested household", () => {
  assert.equal(pickHousehold(memberships)?.householdId, A);
  assert.equal(pickHousehold(memberships, B)?.householdId, B);
  assert.equal(pickHousehold(memberships, B.toUpperCase())?.householdId, B);
});

test("lenient mode (cookie) falls back; strict mode (explicit header) refuses a household you are not in", () => {
  const stranger = "33333333-3333-4333-8333-333333333333";
  assert.equal(pickHousehold(memberships, stranger)?.householdId, A);
  assert.equal(pickHousehold(memberships, "garbage")?.householdId, A);
  assert.throws(() => pickHousehold(memberships, stranger, true), ForbiddenError);
  assert.throws(() => pickHousehold(memberships, "garbage", true), ForbiddenError);
});

test("no memberships yields null", () => {
  assert.equal(pickHousehold([], A), null);
});

test("readCookie parses, decodes and tolerates junk", () => {
  assert.equal(readCookie("a=1; haven_household=abc%20d; b=2", "haven_household"), "abc d");
  assert.equal(readCookie(null, "x"), null);
  assert.equal(readCookie("x=%E0%A4%A", "x"), null);
  assert.equal(readCookie("notacookie", "notacookie"), null);
});

test("household cookie is HttpOnly + SameSite and round-trips through readCookie; Secure only when asked", () => {
  const c = serializeHouseholdCookie(A, true);
  assert.ok(c.includes("HttpOnly") && c.includes("SameSite=Lax") && c.includes("Secure") && c.includes("Path=/"));
  assert.ok(!serializeHouseholdCookie(A, false).includes("Secure"));
  assert.equal(readCookie(c.split(";")[0], "haven_household"), A);
});
