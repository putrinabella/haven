import "server-only";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { requireUser } from "./auth";
import { AppError, RateLimitedError } from "./errors";
import { consumeRateLimit, type RateLimitConfig } from "./rate-limit";
import { HOUSEHOLD_COOKIE, HOUSEHOLD_HEADER, type HouseholdRole } from "./tenancy-core";
import { requireRole, resolveHousehold, type HouseholdContext } from "./tenancy";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** Stable machine-readable code ("unauthorized", "forbidden", "rate_limited", ...). */
      code?: string;
      fieldErrors?: Record<string, string[]>;
      retryAfterSeconds?: number;
    };

export const DEFAULT_ACTION_RATE_LIMIT: RateLimitConfig = { limit: 60, windowSeconds: 60 };

interface ActionOptions<S extends z.ZodType> {
  /** Unique, stable name. It namespaces the rate-limit bucket (limits are per user, per action). */
  name: string;
  input: S;
  /** Override the default (60/min) or pass `false` to opt out explicitly. */
  rateLimit?: RateLimitConfig | false;
}

function makeAction<S extends z.ZodType, C extends { userId: string }, T>(
  options: ActionOptions<S>,
  getContext: () => Promise<C>,
  handler: (input: z.infer<S>, ctx: C) => Promise<T>,
) {
  const limit = options.rateLimit === undefined ? DEFAULT_ACTION_RATE_LIMIT : options.rateLimit;

  return async (raw: unknown): Promise<ActionResult<T>> => {
    try {
      const ctx = await getContext(); // authenticate (+ household/role) first

      if (limit) {
        const result = await consumeRateLimit(`action:${options.name}`, ctx.userId, limit);
        if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds);
      }

      const parsed = options.input.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          error: "Invalid input",
          code: "validation_failed",
          fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
        };
      }
      return { ok: true, data: await handler(parsed.data, ctx) };
    } catch (e) {
      if (e instanceof AppError) {
        return {
          ok: false,
          error: e.message,
          code: e.code,
          fieldErrors: e.fieldErrors,
          retryAfterSeconds: e instanceof RateLimitedError ? e.retryAfterSeconds : undefined,
        };
      }
      console.error("[action]", options.name, e); // full detail stays server-side
      return { ok: false, error: "Something went wrong", code: "internal_error" };
    }
  };
}

/**
 * The ONLY sanctioned way to export a Server Action. Order: authenticate -> rate limit -> validate -> run.
 * The checks live inside the exported function, so calling the action directly (a hand-crafted POST)
 * cannot skip them. action-guard.test.ts fails CI for any "use server" export that bypasses the wrapper.
 */
export function defineAction<S extends z.ZodType, T>(
  options: ActionOptions<S>,
  handler: (input: z.infer<S>, ctx: { userId: string }) => Promise<T>,
) {
  return makeAction(options, async () => ({ userId: (await requireUser()).id }), handler);
}

/** Same pipeline, plus the active household and role (cookie-selected; `minRole` defaults to "member"). */
export function defineHouseholdAction<S extends z.ZodType, T>(
  options: ActionOptions<S> & { minRole?: HouseholdRole },
  handler: (input: z.infer<S>, ctx: HouseholdContext) => Promise<T>,
) {
  return makeAction(
    options,
    async () => {
      const user = await requireUser();
      const [h, c] = await Promise.all([headers(), cookies()]);
      const header = h.get(HOUSEHOLD_HEADER);
      const ctx = await resolveHousehold(user.id, {
        requestedId: header ?? c.get(HOUSEHOLD_COOKIE)?.value,
        strict: header !== null,
      });
      requireRole(ctx, options.minRole ?? "member");
      return ctx;
    },
    handler,
  );
}
