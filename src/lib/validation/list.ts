import { z } from "zod";

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(100).default(15),
  sort: z.string().max(50).default(""),
  dir: z.enum(["asc", "desc"]).default("desc"),
});