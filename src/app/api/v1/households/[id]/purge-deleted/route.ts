import { z } from "zod";
import { purgeSoftDeleted } from "@/server/purge";
import { defineRoute } from "@/server/route";
import { requireMembership } from "@/server/tenancy";

const params = z.object({ id: z.uuid() });
const body = z.object({ olderThanDays: z.number().int().min(1).max(3650).optional() });

/**
 * Permanently deletes everything this household has soft deleted. Owner only, irreversible.
 * Send {} to purge all trash, or { "olderThanDays": 30 } to keep recent items restorable.
 */
export const POST = defineRoute(
  { name: "households.purgeDeleted", params, body, rateLimit: { limit: 5, windowSeconds: 3600 } },
  async ({ user, params, body }) => {
    const ctx = await requireMembership(user.id, params.id, "owner");
    return purgeSoftDeleted(ctx, { olderThanDays: body.olderThanDays });
  },
);
