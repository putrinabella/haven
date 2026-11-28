import "server-only";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

type HouseholdScoped = { householdId: AnyPgColumn; deletedAt: AnyPgColumn };

/**
 * THE read filter for household data: this household's rows that are not soft deleted.
 * Every query on a household-owned table must include it (never filter by id alone):
 *   db.select().from(items).where(and(forHousehold(items, ctx.householdId), eq(items.id, id)))
 * Scoping by household in the query itself is what makes "id from another household" a 404.
 */
export const forHousehold = (t: HouseholdScoped, householdId: string) =>
  and(eq(t.householdId, householdId), isNull(t.deletedAt));

/** The "trash": this household's soft-deleted rows. */
export const trashOf = (t: HouseholdScoped, householdId: string) =>
  and(eq(t.householdId, householdId), isNotNull(t.deletedAt));

/** Typed fragments for UPDATE .. SET so feature code stays fully type-checked against its own table. */
export const softDeleteValues = (ctx: { userId: string }) => ({ deletedAt: new Date(), deletedBy: ctx.userId });
export const restoreValues = () => ({ deletedAt: null, deletedBy: null });
