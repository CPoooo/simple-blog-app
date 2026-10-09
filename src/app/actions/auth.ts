"use server";

import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, users } from "@/db";
import { loginSchema, registerSchema, type AuthFormState } from "@/lib/definitions";
import { createSession, destroySession } from "@/lib/session";

const BCRYPT_COST = 12;

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

  await createSession(created.id);
  redirect("/");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = { email: str(formData.get("email")) };
  const parsed = loginSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { errors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { email, password } = parsed.data;
  const user = await getDb().query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, passwordHash: true },
  });

  const valid = await bcrypt.compare(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    return { message: "Invalid email or password.", values };
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
