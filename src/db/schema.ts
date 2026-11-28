import { boolean, index, integer, pgEnum, pgTable, primaryKey, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "./columns";

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Infrastructure table for Server Action rate limiting (fixed windows).
 * One row per (hashed subject + action, window). Old windows are purged opportunistically
 * by src/server/rate-limit.ts, so no cron is needed.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    index("rate_limits_window_start_idx").on(t.windowStart),
  ],
);

// ---------------------------------------------------------------------------------------------
// Tenancy: data is shared by HOUSEHOLD. A user can belong to several households (one active at
// a time); every domain table is owned by exactly one household via `householdOwned()`.
// `user_id` is plain text WITHOUT a foreign key: users live in Neon Auth's own schema, and a
// text column works whatever type its id has. Authorization is enforced in src/server/tenancy.ts.
// ---------------------------------------------------------------------------------------------

export const householdRole = pgEnum("household_role", ["owner", "admin", "member"]);

export const households = pgTable("households", {
  ...baseColumns(),
  name: text("name").notNull(),
  createdBy: text("created_by").notNull(),
});

/** Membership is access control, not user content: removing a member is a real delete. */
export const householdMembers = pgTable(
  "household_members",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: householdRole("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] }), index("household_members_user_idx").on(t.userId)],
);

/**
 * Columns for any table whose rows belong to a household. Spread next to baseColumns():
 *   pgTable("things", { ...baseColumns(), ...householdOwned(), name: text("name").notNull() },
 *     (t) => [index("things_household_idx").on(t.householdId)])
 * onDelete "restrict": a household with data cannot be hard deleted by accident.
 */
export const householdOwned = () => ({
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id, { onDelete: "restrict" }),
  createdBy: text("created_by").notNull(),
});
