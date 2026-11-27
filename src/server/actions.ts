import "server-only";
import { z } from "zod";
import { requireUser } from "./auth";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function defineAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.infer<S>, ctx: { userId: string }) => Promise<T>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const user = await requireUser(); // throws if unauthenticated
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Invalid input", fieldErrors: z.flattenError(parsed.error).fieldErrors };
    }
    try {
      return { ok: true, data: await handler(parsed.data, { userId: user.id }) };
    } catch (e) {
      console.error(e);
      return { ok: false, error: "Something went wrong" };
    }
  };
}