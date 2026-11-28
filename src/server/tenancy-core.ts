// Pure tenancy rules (no I/O, no framework imports): unit-testable in plain Node.
import { ForbiddenError } from "./errors.ts";

export type HouseholdRole = "owner" | "admin" | "member";

export const HOUSEHOLD_COOKIE = "haven_household";
export const HOUSEHOLD_HEADER = "x-household-id";

const RANK: Record<HouseholdRole, number> = { member: 1, admin: 2, owner: 3 };

export const roleAtLeast = (role: HouseholdRole, min: HouseholdRole): boolean => RANK[role] >= RANK[min];

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Chooses the active household from the user's memberships (already sorted oldest first).
 * - `requestedId` valid and a membership -> that one.
 * - `strict` (an explicit X-Household-Id header): an id the user does not belong to is a 403,
 *   never a silent fallback, so a client can't believe it acted on household A while acting on B.
 * - otherwise (stale cookie): fall back to the first membership.
 */
export function pickHousehold<T extends { householdId: string }>(
  memberships: T[],
  requestedId?: string | null,
  strict = false,
): T | null {
  if (requestedId) {
    const match = isUuid(requestedId) ? memberships.find((m) => m.householdId === requestedId.toLowerCase()) : undefined;
    if (match) return match;
    if (strict) throw new ForbiddenError("You are not a member of that household");
  }
  return memberships[0] ?? null;
}

/** Reads one cookie value from a raw Cookie header without framework helpers. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Set-Cookie value for the active household. HttpOnly: page scripts never need to read it. */
export function serializeHouseholdCookie(householdId: string, secure: boolean): string {
  return [
    `${HOUSEHOLD_COOKIE}=${encodeURIComponent(householdId)}`,
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 365}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
