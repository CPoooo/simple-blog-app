import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { getSessionUserId } from "@/lib/session";

export type CurrentUser = { id: number; username: string };

/**
 * The one place that turns a session cookie into a user. Deduped per request,
 * so any number of components can call it. Reads cookies, so callers must sit
 * behind a <Suspense> boundary (Cache Components).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await getSessionUserId();
  if (userId === null) return null;

  // A valid token for a deleted user is treated as signed out.
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true },
  });
  return user ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
