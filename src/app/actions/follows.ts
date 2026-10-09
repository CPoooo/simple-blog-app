"use server";

import { and, count, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { follows, getDb, users } from "@/db";
import { requireUser } from "@/lib/dal";

export type FollowResult = { following: boolean; followers: number } | { error: string };

export async function toggleFollow(rawUserId: unknown): Promise<FollowResult> {
  const me = await requireUser();
  const parsed = z.coerce.number().int().positive().safeParse(rawUserId);
  if (!parsed.success) return { error: "User not found." };
  const targetId = parsed.data;
  // The database refuses this too (CHECK constraint); this is just the friendly message.
  if (targetId === me.id) return { error: "You can't follow yourself (nice try)." };

  const db = getDb();
  const target = await db.query.users.findFirst({ where: eq(users.id, targetId), columns: { id: true } });
  if (!target) return { error: "User not found." };

  const removed = await db
    .delete(follows)
    .where(and(eq(follows.followerId, me.id), eq(follows.followingId, targetId)))
    .returning({ id: follows.followingId });
  if (removed.length === 0) {
    await db.insert(follows).values({ followerId: me.id, followingId: targetId }).onConflictDoNothing();
  }

  const [row] = await db.select({ n: count() }).from(follows).where(eq(follows.followingId, targetId));
  // Their follower count and my following count both changed.
  updateTag(`follows:${targetId}`);
  updateTag(`follows:${me.id}`);
  return { following: removed.length === 0, followers: row?.n ?? 0 };
}
