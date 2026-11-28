import { z } from "zod";
import { defineRoute, reply } from "@/server/route";
import { requireMembership } from "@/server/tenancy";
import { serializeHouseholdCookie } from "@/server/tenancy-core";

const schema = z.object({ householdId: z.uuid() });

/** Selects which household the first-party pages act on (stored in an HttpOnly cookie). */
export const PUT = defineRoute({ name: "households.setActive", body: schema }, async ({ user, body }) => {
  const ctx = await requireMembership(user.id, body.householdId); // 403 if not a member
  return reply(
    { householdId: ctx.householdId, role: ctx.role },
    { headers: { "set-cookie": serializeHouseholdCookie(ctx.householdId, process.env.NODE_ENV === "production") } },
  );
});
