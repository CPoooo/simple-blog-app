"use server";

import bcrypt from "bcryptjs";
import { del, list } from "@vercel/blob";
import { and, eq, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, oauthAccounts, users } from "@/db";
import { avatarPrefix, postImagePrefix } from "@/lib/blob";
import { requireUser } from "@/lib/dal";
import { email, password } from "@/lib/definitions";
import { loginMethods } from "@/lib/oauth-accounts";
import { clearAttempts, isLimited, recordAttempt } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/session";

const BCRYPT_COST = 12;
const LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const TOO_MANY = "Too many wrong passwords. Wait a few minutes and try again.";

export type AccountFormState =
  | { errors?: Record<string, string[] | undefined>; message?: string; saved?: boolean; values?: { email?: string } }
  | undefined;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

/**
 * Sensitive changes need the current password, even with a valid session: a borrowed
 * laptop or a stolen cookie shouldn't be enough to take over the account. Wrong
 * guesses count toward a per-account limit, like login. Accounts that only ever used
 * Google/GitHub/Facebook have no password, so there's nothing to check for them.
 */
async function checkCurrentPassword(userId: number, attempt: string): Promise<string | null> {
  const [row] = await getDb().select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!row) return "Account not found.";
  if (row.hash === null) return null;
  if (!attempt) return "Enter your current password";

  const key = `account:user:${userId}`;
  if (await isLimited(key, LIMIT.max, LIMIT.windowMs)) return TOO_MANY;
  if (!(await bcrypt.compare(attempt, row.hash))) {
    await recordAttempt(key);
    return "That's not your current password.";
  }
  await clearAttempts(key);
  return null;
}

const emailForm = z.object({ email, currentPassword: z.string() });

export async function changeEmail(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const values = { email: str(formData.get("email")) };
  const parsed = emailForm.safeParse({ ...values, currentPassword: str(formData.get("currentPassword")) });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };

  const wrong = await checkCurrentPassword(user.id, parsed.data.currentPassword);
  if (wrong) return { errors: { currentPassword: [wrong] }, values };

  const db = getDb();
  const taken = await db.query.users.findFirst({
    where: and(eq(users.email, parsed.data.email), ne(users.id, user.id)),
    columns: { id: true },
  });
  if (taken) return { errors: { email: ["An account with this email already exists"] }, values };

  try {
    await db.update(users).set({ email: parsed.data.email }).where(eq(users.id, user.id));
  } catch {
    return { errors: { email: ["That email was just taken. Try another."] }, values };
  }
  return { saved: true, message: "Email updated.", values: { email: parsed.data.email } };
}

const passwordForm = z
  .object({
    currentPassword: z.string(),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((v) => !v.currentPassword || v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Pick a password you aren't already using",
  });

/** Change it, or for social-only accounts, set one for the first time. */
export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = passwordForm.safeParse({
    currentPassword: str(formData.get("currentPassword")),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const wrong = await checkCurrentPassword(user.id, parsed.data.currentPassword);
  if (wrong) return { errors: { currentPassword: [wrong] } };

  // New hash + bumped token_version in one statement: every existing session dies...
  const [row] = await getDb()
    .update(users)
    .set({ passwordHash: await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST), tokenVersion: sql`${users.tokenVersion} + 1` })
    .where(eq(users.id, user.id))
    .returning({ tokenVersion: users.tokenVersion });

  // ...except this one, which gets a fresh token at the new version.
  await createSession(user.id, row.tokenVersion);
  return { saved: true, message: "Password saved. You've been signed out everywhere else." };
}

export type DisconnectState = { error?: string } | undefined;

/** Unlink Google/GitHub/Facebook, unless it's the only way left to sign in. */
export async function disconnectProvider(_prev: DisconnectState, formData: FormData): Promise<DisconnectState> {
  const user = await requireUser();
  const provider = z.enum(["google", "github", "facebook"]).safeParse(formData.get("provider"));
  if (!provider.success) return { error: "Unknown provider." };

  const methods = await loginMethods(user.id);
  if (!methods.providers.includes(provider.data)) return { error: "That account isn't connected." };
  if (!methods.hasPassword && methods.linkCount <= 1) {
    return { error: "Set a password (or connect another account) first, otherwise you'd have no way to sign in." };
  }
  await getDb()
    .delete(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, user.id), eq(oauthAccounts.provider, provider.data)));
  redirect("/settings/account?disconnected=" + provider.data);
}

export type DeleteState = { errors?: Record<string, string[] | undefined> } | undefined;

/**
 * Deletes the account and everything in it: posts, comments, likes, follows, bookmarks,
 * notifications (database cascades) and uploaded images (Blob). There is no undo.
 */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await requireUser();
  if (str(formData.get("confirm")).trim().toLowerCase() !== user.username) {
    return { errors: { confirm: [`Type your username (${user.username}) to confirm`] } };
  }
  const wrong = await checkCurrentPassword(user.id, str(formData.get("currentPassword")));
  if (wrong) return { errors: { currentPassword: [wrong] } };

  // Files first: once the row is gone we'd have no record of whose folder this was.
  for (const prefix of [avatarPrefix(user.id), postImagePrefix(user.id)]) {
    try {
      const { blobs } = await list({ prefix, limit: 1000 });
      if (blobs.length) await del(blobs.map((b) => b.url));
    } catch (err) {
      console.error("blob cleanup on account deletion failed", err); // don't block deletion on storage hiccups
    }
  }
  await getDb().delete(users).where(eq(users.id, user.id));
  await destroySession();
  redirect("/goodbye");
}
