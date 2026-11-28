import "server-only";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "./auth";
import { consumeRateLimit, type RateLimitConfig } from "./rate-limit";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; retryAfterSeconds?: number };

export const DEFAULT_ACTION_RATE_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60 };

interface ActionOptions<S extends z.ZodType> {
  /** Unique, stable name. It namespaces the rate-limit bucket (limits are per user, per action). */
  name: string;
  input: S;
  /** Override the default (60/min) or pass `false` to opt out explicitly. */
  rateLimit?: RateLimitConfig | false;
}

/**
 * The ONLY sanctioned way to export a Server Action. Order: authenticate -> rate limit -> validate -> run.
 * Because the checks live inside the exported function itself, calling the action directly
 * (e.g. a hand-crafted POST) cannot skip them. action-guard.test.ts fails CI for any
 * "use server" export that does not go through this wrapper.
 */
export function defineAction<S extends z.ZodType, T>(
  options: ActionOptions<S>,
  handler: (input: z.infer<S>, ctx: { userId: string }) => Promise<T>,
) {
  const limit = options.rateLimit === undefined ? DEFAULT_ACTION_RATE_LIMIT : options.rateLimit;

  return async (raw: unknown): Promise<ActionResult<T>> => {
    try {
      const user = await requireUser();

      if (limit) {
        const result = await consumeRateLimit(`action:${options.name}`, user.id, limit);
        if (!result.allowed) {
          return { ok: false, error: "Too many requests", retryAfterSeconds: result.retryAfterSeconds };
        }
      }

      const parsed = options.input.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid input",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }
      return { ok: true, data: await handler(parsed.data, { userId: user.id }) };
    } catch (e) {
      if (e instanceof UnauthorizedError) return { ok: false, error: "Unauthorized" };
      console.error("[action]", options.name, e); // full detail stays server-side
      return { ok: false, error: "Something went wrong" };
    }
  };
}
