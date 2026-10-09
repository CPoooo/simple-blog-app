import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { getSession } from "@/lib/session";

export type CurrentUser = { id: number; username: string; avatarUrl: string | null };

/**
 * Cookie -> verified user, no caching. Use directly in Route Handlers; in
 * components and actions use getCurrentUser()/requireUser() instead.
 *
 * A token only counts if its version still matches the user's token_version:
 * changing your password bumps the version, which instantly kills every other
 * session (stateless JWTs can't be revoked any other way). A valid token for a
 * deleted user is also treated as signed out.
 */
export async function authenticate(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await getDb().query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { id: true, username: true, avatarUrl: true, tokenVersion: true },
  });
  if (!user || user.tokenVersion !== session.version) return null;
  return { id: user.id, username: user.username, avatarUrl: user.avatarUrl };
}

/**
 * The one place components turn a session cookie into a user. Callers must sit
 * behind a <Suspense> boundary (Cache Components).
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
  return authenticate();
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
