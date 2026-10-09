"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { bookmarks, getDb, posts } from "@/db";
import { requireUser } from "@/lib/dal";

export type BookmarkResult = { bookmarked: boolean } | { error: string };

export async function toggleBookmark(rawPostId: unknown): Promise<BookmarkResult> {
  const user = await requireUser();
  const parsed = z.coerce.number().int().positive().safeParse(rawPostId);
  if (!parsed.success) return { error: "Post not found." };
  const postId = parsed.data;

  const db = getDb();
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNotNull(posts.publishedAt)),
    columns: { id: true },
  });
  if (!post) return { error: "Post not found." };

  const removed = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.userId, user.id), eq(bookmarks.postId, postId)))
    .returning({ postId: bookmarks.postId });
  if (removed.length === 0) {
    await db.insert(bookmarks).values({ userId: user.id, postId }).onConflictDoNothing();
  }
  // Nothing shared to invalidate: bookmarks are private and always read fresh.
  return { bookmarked: removed.length === 0 };
}
