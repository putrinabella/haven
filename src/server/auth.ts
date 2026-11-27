import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

/** Returns the signed-in user, or null. Always validated server-side from the session cookie. */
export async function getUser() {
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

/** For Server Actions / route handlers: throws if there is no session. */
export async function requireUser() {
  const user = await getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** For pages and layouts: redirects to /login if there is no session. */
export async function requirePageUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
