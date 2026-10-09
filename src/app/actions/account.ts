"use server";

import bcrypt from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, users } from "@/db";
import { requireUser } from "@/lib/dal";
import { email, password } from "@/lib/definitions";
import { clearAttempts, isLimited, recordAttempt } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";

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
 * guesses count toward a per-account limit, like login.
 */
async function checkCurrentPassword(userId: number, attempt: string): Promise<string | null> {
  const key = `account:user:${userId}`;
  if (await isLimited(key, LIMIT.max, LIMIT.windowMs)) return TOO_MANY;
  const [row] = await getDb().select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!row || !(await bcrypt.compare(attempt, row.hash))) {
    await recordAttempt(key);
    return "That's not your current password.";
  }
  await clearAttempts(key);
  return null;
}

const emailForm = z.object({ email, currentPassword: z.string().min(1, "Enter your current password") });

export async function changeEmail(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const values = { email: str(formData.get("email")) };
  const parsed = emailForm.safeParse({ ...values, currentPassword: formData.get("currentPassword") });
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
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Pick a password you aren't already using" });

export async function changePassword(_prev: AccountFormState, formData: FormData): Promise<AccountFormState> {
  const user = await requireUser();
  const parsed = passwordForm.safeParse({
    currentPassword: formData.get("currentPassword"),
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
  return { saved: true, message: "Password changed. You've been signed out everywhere else." };
}
