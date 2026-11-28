// Pure logic, no I/O and no server-only import, so it can be unit-tested in plain Node.
import { createHash } from "node:crypto";

export interface RateLimitConfig {
  /** Max calls allowed per window. */
  limit: number;
  /** Window length in whole seconds (1..86400). */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export const MAX_WINDOW_SECONDS = 86_400;

/** Config is inlined into SQL (window math), so it must be a strictly validated integer. */
export function assertValidConfig(config: RateLimitConfig): void {
  const { limit, windowSeconds } = config;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("rateLimit.limit must be a positive integer");
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > MAX_WINDOW_SECONDS) {
    throw new RangeError(`rateLimit.windowSeconds must be an integer between 1 and ${MAX_WINDOW_SECONDS}`);
  }
}

/** Subjects (user ids, IPs) are hashed so the table holds no raw identifiers and keys stay bounded. */
export function buildKey(namespace: string, subject: string): string {
  const digest = createHash("sha256").update(subject).digest("hex").slice(0, 32);
  return `${namespace}:${digest}`;
}

export function evaluate(
  count: number,
  config: RateLimitConfig,
  windowStartEpochSeconds: number,
  nowEpochSeconds: number,
): RateLimitResult {
  const windowEnd = windowStartEpochSeconds + config.windowSeconds;
  return {
    allowed: count <= config.limit,
    remaining: Math.max(0, config.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil(windowEnd - nowEpochSeconds)),
  };
}
