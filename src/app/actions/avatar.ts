"use server";

import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { getDb, users } from "@/db";
import { isOwnAvatarUrl } from "@/lib/blob";
import { requireUser } from "@/lib/dal";

export type AvatarResult = { avatarUrl: string | null } | { error: string };

/** Old files are cleaned up best-effort: a failed delete shouldn't fail the user's save. */
async function deleteOld(url: string | null | undefined, userId: number) {
  if (url && isOwnAvatarUrl(url, userId)) await del(url).catch(() => {});
}

async function currentAvatar(userId: number) {
  const [row] = await getDb().select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, userId));
  return row?.avatarUrl ?? null;
}

/** Called by the browser after a direct-to-Blob upload, with the URL Blob returned. */
export async function setAvatar(rawUrl: unknown): Promise<AvatarResult> {
  const user = await requireUser();
  const parsed = z.string().max(500).safeParse(rawUrl);
  // Only a file in our store, inside this user's own folder. Without this check anyone
  // could set their avatar to any image on the internet (or someone else's upload).
  if (!parsed.success || !isOwnAvatarUrl(parsed.data, user.id)) return { error: "That image didn't come from here." };

  const previous = await currentAvatar(user.id);
  await getDb().update(users).set({ avatarUrl: parsed.data }).where(eq(users.id, user.id));
  if (previous !== parsed.data) await deleteOld(previous, user.id);

  updateTag(`user:${user.id}`);
  return { avatarUrl: parsed.data };
}

export async function removeAvatar(): Promise<AvatarResult> {
  const user = await requireUser();
  const previous = await currentAvatar(user.id);
  await getDb().update(users).set({ avatarUrl: null }).where(eq(users.id, user.id));
  await deleteOld(previous, user.id);
  updateTag(`user:${user.id}`);
  return { avatarUrl: null };
}
