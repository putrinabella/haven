import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/server/env";
import * as schema from "./schema";

// neon-http: stateless HTTP queries, ideal for serverless/edge. It does NOT support
// interactive transactions; if you need them, switch to drizzle-orm/neon-serverless (Pool + ws)
// with DATABASE_URL_POOLED.
export const db = drizzle(neon(env.DATABASE_URL), { schema });
