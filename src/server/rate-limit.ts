import "server-only";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import {
  assertValidConfig,
  buildKey,
  evaluate,
  type RateLimitConfig,
  type RateLimitResult,
} from "./rate-limit-core";

export type { RateLimitConfig, RateLimitResult } from "./rate-limit-core";

const PURGE_PROBABILITY = 0.01;

/**
 * Counts one call against (namespace, subject) in a Postgres-backed fixed window.
 *
 * - Shared across all serverless instances (state lives in Neon, never in memory).
 * - A single INSERT .. ON CONFLICT DO UPDATE .. RETURNING statement, so the increment is atomic
 *   even under concurrent requests and works with the stateless neon-http driver.
 * - Window boundaries are computed by the database clock, not by app instances.
 * Fixed windows allow up to 2x the limit across a window boundary; acceptable for abuse protection.
 */
export async function consumeRateLimit(
  namespace: string,
  subject: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  assertValidConfig(config);
  const w = sql.raw(String(config.windowSeconds)); // validated integer, safe to inline
  const windowStart = sql`to_timestamp(floor(extract(epoch from now()) / ${w}) * ${w})`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key: buildKey(namespace, subject), windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });

  if (Math.random() < PURGE_PROBABILITY) {
    // Housekeeping; windows are capped at 24h so anything older than that is dead.
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`))
      .catch((e: unknown) => console.error("[rate-limit] purge failed", e));
  }

  return evaluate(row.count, config, row.windowStart.getTime() / 1000, Date.now() / 1000);
}
