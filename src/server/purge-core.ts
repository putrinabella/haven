// Pure orchestration for hard-deleting soft-deleted rows. No DB, so the policy is unit-testable.

export interface PurgeEntry<T = unknown> {
  name: string;
  table: T;
}

export interface PurgeReport {
  /** rows hard deleted, per table */
  purged: Record<string, number>;
  /** tables left untouched because live rows still reference their soft-deleted rows */
  blocked: { table: string; reason: string }[];
}

/** Postgres foreign_key_violation. Drivers/ORMs wrap errors, so walk the cause chain. */
export function isForeignKeyViolation(error: unknown): boolean {
  let e: unknown = error;
  for (let depth = 0; e && typeof e === "object" && depth < 5; depth++) {
    if ((e as { code?: unknown }).code === "23503") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Runs `deleteRows` per entry IN THE GIVEN ORDER. Register children before parents so a parent's
 * soft-deleted rows are removed after the rows that reference them. A foreign-key violation means a
 * LIVE row still points at a soft-deleted one: that table is reported as blocked and skipped, not
 * force-deleted and not allowed to abort the other tables. Any other error is rethrown.
 */
export async function runPurge<T>(
  entries: PurgeEntry<T>[],
  deleteRows: (entry: PurgeEntry<T>) => Promise<number>,
): Promise<PurgeReport> {
  const report: PurgeReport = { purged: {}, blocked: [] };
  for (const entry of entries) {
    try {
      report.purged[entry.name] = await deleteRows(entry);
    } catch (e) {
      if (!isForeignKeyViolation(e)) throw e;
      report.blocked.push({
        table: entry.name,
        reason: "Active records still reference deleted ones. Restore or delete those first.",
      });
    }
  }
  return report;
}
