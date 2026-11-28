import "server-only";
import { and, eq, isNotNull, lt, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { ForbiddenError } from "./errors";
import { runPurge, type PurgeEntry, type PurgeReport } from "./purge-core";
import { roleAtLeast } from "./tenancy-core";
import type { HouseholdContext } from "./tenancy";

type SoftDeletableTable = PgTable & { id: AnyPgColumn; householdId: AnyPgColumn; deletedAt: AnyPgColumn };

/**
 * Every household-owned table with soft delete registers here, CHILDREN BEFORE PARENTS
 * (a table that has a foreign key to another comes first). Example once a feature exists:
 *   import { items } from "@/features/items/schema";
 *   { name: "items", table: items },
 */
export const softDeletableTables: PurgeEntry<SoftDeletableTable>[] = [];

/**
 * Permanently deletes everything this household has soft deleted. Owner only: it is irreversible.
 * `olderThanDays` keeps recent trash restorable. Memberships and the household itself are untouched.
 */
export async function purgeSoftDeleted(
  ctx: HouseholdContext,
  opts: { olderThanDays?: number } = {},
  entries: PurgeEntry<SoftDeletableTable>[] = softDeletableTables,
): Promise<PurgeReport> {
  if (!roleAtLeast(ctx.role, "owner")) throw new ForbiddenError("Only a household owner can permanently delete data");

  const cutoff =
    opts.olderThanDays && opts.olderThanDays > 0
      ? new Date(Date.now() - opts.olderThanDays * 86_400_000)
      : null;

  return runPurge(entries, async ({ table }) => {
    const conditions: (SQL | undefined)[] = [eq(table.householdId, ctx.householdId), isNotNull(table.deletedAt)];
    if (cutoff) conditions.push(lt(table.deletedAt, cutoff));
    const rows = await db
      .delete(table)
      .where(and(...conditions))
      .returning({ id: table.id });
    return rows.length;
  });
}
