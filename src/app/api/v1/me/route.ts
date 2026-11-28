import { defineRoute } from "@/server/route";

/** The signed-in user. Smallest possible reference for an authenticated route. */
export const GET = defineRoute({ name: "me.get" }, async ({ user }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
}));
