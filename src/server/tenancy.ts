import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { householdMembers, households } from "@/db/schema";
import { ForbiddenError, NoHouseholdError } from "./errors";
import { pickHousehold, roleAtLeast, type HouseholdRole } from "./tenancy-core";

export type { HouseholdRole } from "./tenancy-core";

/** The only thing feature code needs to know: who is acting, in which household, with what role. */
export interface HouseholdContext {
  userId: string;
  householdId: string;
  role: HouseholdRole;
}

export async function listMemberships(userId: string) {
  return db
    .select({
      householdId: householdMembers.householdId,
      role: householdMembers.role,
      name: households.name,
      joinedAt: householdMembers.createdAt,
    })
    .from(householdMembers)
    .innerJoin(
      households,
      and(eq(households.id, householdMembers.householdId), isNull(households.deletedAt)),
    )
    .where(eq(householdMembers.userId, userId))
    .orderBy(asc(householdMembers.createdAt));
}

/** Resolves the active household for a user. Throws NoHouseholdError if they have none. */
export async function resolveHousehold(
  userId: string,
  opts: { requestedId?: string | null; strict?: boolean } = {},
): Promise<HouseholdContext> {
  const memberships = await listMemberships(userId);
  const chosen = pickHousehold(memberships, opts.requestedId, opts.strict);
  if (!chosen) throw new NoHouseholdError();
  return { userId, householdId: chosen.householdId, role: chosen.role };
}

/** Membership + minimum role check for a household named explicitly (e.g. in a URL path). */
export async function requireMembership(
  userId: string,
  householdId: string,
  minRole: HouseholdRole = "member",
): Promise<HouseholdContext> {
  const memberships = await listMemberships(userId);
  const m = memberships.find((x) => x.householdId === householdId);
  // Same response for "not a member" and "no such household": do not reveal which ids exist.
  if (!m) throw new ForbiddenError("You are not a member of that household");
  if (!roleAtLeast(m.role, minRole)) throw new ForbiddenError();
  return { userId, householdId, role: m.role };
}

export function requireRole(ctx: HouseholdContext, minRole: HouseholdRole): void {
  if (!roleAtLeast(ctx.role, minRole)) throw new ForbiddenError();
}
