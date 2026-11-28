import { sql, type SQL } from "drizzle-orm";
import { text, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Columns every domain table gets: UUID id, timestamps, and soft-delete bookkeeping.
 * Spread it into a table:   pgTable("things", { ...baseColumns(), name: text("name").notNull() })
 *
 * Deletion convention: rows are SOFT deleted (deleted_at set) in normal operation, and only a
 * household owner can HARD delete everything already soft deleted (see src/server/purge.ts).
 */
export const baseColumns = () => ({
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  /** Auth user id that soft deleted the row (audit trail, shown in a "trash" view). */
  deletedBy: text("deleted_by"),
});

/**
 * Use as the WHERE of every UNIQUE index on a soft-deletable table:
 *   uniqueIndex("things_household_name_uq").on(t.householdId, t.name).where(activeOnly(t))
 * Without it, a soft-deleted row keeps holding its unique value and a legitimate re-create fails
 * with a duplicate-key error caused by data the user believes is gone.
 */
export const activeOnly = (t: { deletedAt: AnyPgColumn }): SQL => sql`${t.deletedAt} IS NULL`;
