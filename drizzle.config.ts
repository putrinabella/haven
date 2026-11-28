import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

export default defineConfig({
  // Relative imports only inside these files: drizzle-kit does not resolve the "@/" alias.
  schema: ["./src/db/schema.ts", "./src/features/*/schema.ts"],
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
