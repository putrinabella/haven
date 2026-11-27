import "server-only";
import { z } from "zod";

/** Validated server env. Importing this fails fast with a readable message if config is wrong. */
const schema = z.object({
  DATABASE_URL: z.url(),
  NEON_AUTH_BASE_URL: z.url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32, "must be at least 32 characters"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example`);
}

export const env = parsed.data;
