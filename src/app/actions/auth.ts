"use server";

import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, users } from "@/db";
import { loginSchema, registerSchema, type AuthFormState } from "@/lib/definitions";
import { clearAttempts, clientIp, isLimited, recordAttempt } from "@/lib/rate-limit";
import { createSession, destroySession } from "@/lib/session";

const BCRYPT_COST = 12;
const MINUTE = 60 * 1000;

// Rate limits. Per-email stops password guessing on one account; per-IP stops
// one machine spraying many accounts or mass-registering.
const LOGIN_EMAIL = { max: 5, windowMs: 15 * MINUTE };
const LOGIN_IP = { max: 20, windowMs: 15 * MINUTE };
const REGISTER_IP = { max: 5, windowMs: 60 * MINUTE };

// Local dev and tests all come from loopback; an unknown IP shouldn't put every such
// request in one shared bucket. Real clients behind Vercel always have an address.
const ipLimited = (ip: string) => !["unknown", "127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);

const TOO_MANY = "Too many attempts. Take a breather and try again in a few minutes.";

// Compared against when the email doesn't exist, so login takes the same time
// either way and doesn't reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hash("timing-equalizer", BCRYPT_COST));

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { username: str(formData.get("username")), email: str(formData.get("email")) };
  const parsed = registerSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const ip = await clientIp();
  const ipKey = `register:ip:${ip}`;
  if (ipLimited(ip) && (await isLimited(ipKey, REGISTER_IP.max, REGISTER_IP.windowMs))) {
    return { message: TOO_MANY, values };
  }

  const { username, email, password } = parsed.data;
  const db = getDb();

  const taken = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)));
  if (taken.length > 0) {
    return {
      errors: {
        email: taken.some((u) => u.email === email) ? ["An account with this email already exists"] : undefined,
        username: taken.some((u) => u.username === username) ? ["That username is taken"] : undefined,
      },
      values,
    };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  // The unique indexes are the real guard; this covers a race between the check and insert.
  const [created] = await db
    .insert(users)
    .values({ username, email, passwordHash })
    .onConflictDoNothing()
    .returning({ id: users.id });
  if (!created) {
    return { message: "That email or username was just taken. Please try another.", values };
  }

  if (ipLimited(ip)) await recordAttempt(ipKey);
  // A cached "no such user" for /u/<username> must not outlive the account's creation.
  updateTag(`username:${username}`);
  await createSession(created.id, 0); // new accounts start at token_version 0
  redirect("/feed");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: str(formData.get("email")) };
  const parsed = loginSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { email, password } = parsed.data;
  const ip = await clientIp();
  const emailKey = `login:email:${email}`;
  const ipKey = `login:ip:${ip}`;

  // Checked before bcrypt, so a locked-out attacker doesn't even cost us a hash.
  const [emailBlocked, ipBlocked] = await Promise.all([
    isLimited(emailKey, LOGIN_EMAIL.max, LOGIN_EMAIL.windowMs),
    ipLimited(ip) ? isLimited(ipKey, LOGIN_IP.max, LOGIN_IP.windowMs) : false,
  ]);
  if (emailBlocked || ipBlocked) return { message: TOO_MANY, values };

  const user = await getDb().query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, passwordHash: true, tokenVersion: true },
  });

  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    // Only failures count toward the limit.
    await recordAttempt(...(ipLimited(ip) ? [emailKey, ipKey] : [emailKey]));
    return { message: "Invalid email or password.", values };
  }

  await clearAttempts(emailKey);
  await createSession(user.id, user.tokenVersion);
  redirect("/feed");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
