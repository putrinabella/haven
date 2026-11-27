import "server-only";
import { z } from "zod";
import { requireUser, UnauthorizedError } from "./auth";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Wraps a Server Action with auth + zod validation + safe error handling.
 * Usage (in a "use server" file): export const createX = defineAction(schema, async (input, { userId }) => ...)
 */
export function defineAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.infer<S>, ctx: { userId: string }) => Promise<T>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    try {
      const user = await requireUser();
      const parsed = schema.safeParse(raw);
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
      console.error("[action]", e); // full detail stays server-side
      return { ok: false, error: "Something went wrong" };
    }
  };
}
