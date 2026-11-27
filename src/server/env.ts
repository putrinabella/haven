import "server-only";
import { z } from "zod";

export const env = z
  .object({
    DATABASE_URL: z.url(),
    NEON_AUTH_BASE_URL: z.url(),
    NEON_AUTH_COOKIE_SECRET: z.string().min(32),
  })
  .parse(process.env);