import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { getSessionUserId } from "@/lib/session";

export type CurrentUser = { id: number; username: string; avatarUrl: string | null };

/**
 * The one place that turns a session cookie into a user. Callers must sit behind
 * a <Suspense> boundary (Cache Components).
 *
 * 'use cache: private' because verifying the JWT compares its expiry with the
 * current time. Runtime prefetches (partialPrefetching) prerender with real
 * cookies but forbid reading the clock in an uncached scope; a private cache
 * scope is allowed to, and its result only ever lives in this user's browser,
 * never in a shared server cache. It also dedupes calls within one request.
 * Login/logout set or delete the cookie in a Server Action, which re-renders
 * the page, so the header never shows a stale user after signing in or out.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";

  const userId = await getSessionUserId();
  if (userId === null) return null;

  // A valid token for a deleted user is treated as signed out.
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, username: true, avatarUrl: true },
  });
  return user ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
