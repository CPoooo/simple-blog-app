"use server";

import { and, eq, ne } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb, users } from "@/db";
import { requireUser } from "@/lib/dal";
import { profileSchema } from "@/lib/definitions";

export type ProfileFormState =
  | {
      errors?: Partial<Record<"username" | "bio", string[]>>;
      saved?: boolean;
      values?: { username: string; bio: string };
    }
  | undefined;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function updateProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  // Always the signed-in user: there's no id field to tamper with.
  const user = await requireUser();
  const values = { username: str(formData.get("username")), bio: str(formData.get("bio")) };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors, values };
  const { username, bio } = parsed.data;

  const db = getDb();
  if (username !== user.username) {
    const taken = await db.query.users.findFirst({
      where: and(eq(users.username, username), ne(users.id, user.id)),
      columns: { id: true },
    });
    if (taken) return { errors: { username: ["That username is taken"] }, values };
  }

  try {
    await db.update(users).set({ username, bio: bio || null }).where(eq(users.id, user.id));
  } catch {
    // The unique index is the real guard; this is someone grabbing the name between check and update.
    return { errors: { username: ["That username was just taken. Try another."] }, values };
  }

  // Every cached page that shows this user's name or bio is tagged with it.
  updateTag(`user:${user.id}`);
  return { saved: true, values: { username, bio } };
}
