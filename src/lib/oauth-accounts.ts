// No "server-only" here on purpose: this is the security-sensitive account-linking logic,
// and keeping it a plain module lets it be tested directly against the database.
import { and, count, eq, sql } from "drizzle-orm";
import { getDb, oauthAccounts, users } from "@/db";

export type Provider = "google" | "github" | "facebook";

export type OAuthProfile = {
  provider: Provider;
  providerUserId: string;
  email: string | null;
  /** True only when the provider vouches for the address (Google, GitHub). Never for Facebook. */
  emailVerified: boolean;
  usernameHint: string;
};

export type OAuthResult =
  | { ok: true; userId: number; tokenVersion: number; created: boolean }
  | { ok: false; error: "account_exists" | "already_linked" };

/** Social-only accounts get a unique, obviously-not-real address (".invalid" is a reserved TLD). */
export const placeholderEmail = (p: OAuthProfile) => `${p.provider}-${p.providerUserId}@users.invalid`;
export const isPlaceholderEmail = (email: string) => email.endsWith("@users.invalid");

/** "Cameron Pool" -> "cameron_pool", "x" -> "x_reader"; then a numeric suffix if it's taken. */
async function uniqueUsername(hint: string): Promise<string> {
  let base = hint
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 15);
  if (base.length < 3) base = `${base}_reader`.replace(/^_/, "");
  const db = getDb();
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(100 + Math.random() * 9900)}`;
    const taken = await db.query.users.findFirst({ where: eq(users.username, candidate), columns: { id: true } });
    if (!taken) return candidate;
  }
  return `reader${Date.now().toString(36)}`.slice(0, 20);
}

async function tokenVersionOf(userId: number) {
  const [row] = await getDb().select({ v: users.tokenVersion }).from(users).where(eq(users.id, userId));
  return row?.v ?? 0;
}

/**
 * Who is this person? In order:
 *  1. We've seen this provider account before                 -> that user.
 *  2. Someone is signed in and connecting a provider          -> link it to them.
 *  3. Verified email matches an existing account              -> link + sign in.
 *     Unverified email matches an existing account            -> refuse (takeover risk).
 *  4. Otherwise                                               -> brand-new account.
 */
export async function resolveOAuthLogin(p: OAuthProfile, signedInUserId: number | null): Promise<OAuthResult> {
  const db = getDb();
  const existing = await db.query.oauthAccounts.findFirst({
    where: and(eq(oauthAccounts.provider, p.provider), eq(oauthAccounts.providerUserId, p.providerUserId)),
    columns: { userId: true },
  });

  if (existing) {
    if (signedInUserId !== null && existing.userId !== signedInUserId) return { ok: false, error: "already_linked" };
    return { ok: true, userId: existing.userId, tokenVersion: await tokenVersionOf(existing.userId), created: false };
  }

  const email = p.email?.trim().toLowerCase() || null;
  const link = (userId: number) => db.insert(oauthAccounts).values({ provider: p.provider, providerUserId: p.providerUserId, userId, email });

  if (signedInUserId !== null) {
    await link(signedInUserId);
    return { ok: true, userId: signedInUserId, tokenVersion: await tokenVersionOf(signedInUserId), created: false };
  }

  if (email) {
    const match = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true, tokenVersion: true } });
    if (match) {
      // Only trust the provider's word that this is the same person when it verified the address.
      if (!p.emailVerified) return { ok: false, error: "account_exists" };
      await link(match.id);
      return { ok: true, userId: match.id, tokenVersion: match.tokenVersion, created: false };
    }
  }

  // New account + its link in one transaction. The link finds the user by its unique username.
  const username = await uniqueUsername(p.usernameHint);
  const [created] = await db.batch([
    db
      .insert(users)
      .values({ username, email: email ?? placeholderEmail(p), passwordHash: null })
      .returning({ id: users.id, tokenVersion: users.tokenVersion }),
    db.insert(oauthAccounts).values({
      provider: p.provider,
      providerUserId: p.providerUserId,
      userId: sql<number>`(select id from users where username = ${username})`,
      email,
    }),
  ]);
  return { ok: true, userId: created[0].id, tokenVersion: created[0].tokenVersion, created: true };
}

/** Ways this person can sign in right now: their password (if set) plus linked providers. */
export async function loginMethods(userId: number) {
  const db = getDb();
  const [[user], [links], providers] = await Promise.all([
    db.select({ hasPassword: sql<boolean>`${users.passwordHash} is not null` }).from(users).where(eq(users.id, userId)),
    db.select({ n: count() }).from(oauthAccounts).where(eq(oauthAccounts.userId, userId)),
    db.select({ provider: oauthAccounts.provider }).from(oauthAccounts).where(eq(oauthAccounts.userId, userId)),
  ]);
  return { hasPassword: Boolean(user?.hasPassword), linkCount: links?.n ?? 0, providers: providers.map((r) => r.provider) };
}
