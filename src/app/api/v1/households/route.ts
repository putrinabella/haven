import { z } from "zod";
import { db } from "@/db";
import { householdMembers, households } from "@/db/schema";
import { created, defineRoute } from "@/server/route";
import { listMemberships } from "@/server/tenancy";

/** Households the signed-in user belongs to, with their role in each. */
export const GET = defineRoute({ name: "households.list" }, async ({ user }) => {
  const rows = await listMemberships(user.id);
  return rows.map((r) => ({ id: r.householdId, name: r.name, role: r.role, joinedAt: r.joinedAt }));
});

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

/** Creates a household and makes the caller its owner. */
export const POST = defineRoute(
  { name: "households.create", body: createSchema, rateLimit: { limit: 10, windowSeconds: 3600 } },
  async ({ user, body }) => {
    const id = crypto.randomUUID();
    // One batch = one transaction on the neon-http driver: never a household without its owner.
    await db.batch([
      db.insert(households).values({ id, name: body.name, createdBy: user.id }),
      db.insert(householdMembers).values({ householdId: id, userId: user.id, role: "owner" }),
    ]);
    return created({ id, name: body.name, role: "owner" as const });
  },
);
