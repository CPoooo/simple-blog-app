"use server";

import { and, count, eq, isNotNull } from "drizzle-orm";
import { updateTag } from "next/cache";
import { z } from "zod";
import { comments, getDb, likes, posts } from "@/db";
import { requireUser } from "@/lib/dal";
import { notify, unnotify } from "@/lib/notifications";

const postIdSchema = z.coerce.number().int().positive();

/**
 * Likes and comments only make sense on published posts; drafts are invisible to
 * everyone else. Returns the author (for notifications), or null if not published.
 */
async function publishedAuthor(postId: number): Promise<number | null> {
  const row = await getDb().query.posts.findFirst({
    where: and(eq(posts.id, postId), isNotNull(posts.publishedAt)),
    columns: { authorId: true },
  });
  return row?.authorId ?? null;
}

export type LikeResult = { liked: boolean; count: number } | { error: string };

export async function toggleLike(rawPostId: unknown): Promise<LikeResult> {
  const user = await requireUser();
  // Arguments to a Server Action arrive from the network: validate, never trust the type annotation.
  const parsed = postIdSchema.safeParse(rawPostId);
  if (!parsed.success) return { error: "Post not found." };
  const postId = parsed.data;
  const authorId = await publishedAuthor(postId);
  if (authorId === null) return { error: "Post not found." };

  const db = getDb();
  // Try to unlike first; if there was nothing to remove, it's a like.
  // The (user_id, post_id) primary key makes a duplicate like impossible even under races.
  const removed = await db
    .delete(likes)
    .where(and(eq(likes.userId, user.id), eq(likes.postId, postId)))
    .returning({ postId: likes.postId });
  const event = { recipientId: authorId, actorId: user.id, type: "like" as const, postId };
  if (removed.length === 0) {
    const [added] = await db.insert(likes).values({ userId: user.id, postId }).onConflictDoNothing().returning({ postId: likes.postId });
    if (added) await notify(event); // only when a like was actually created (a double-click race inserts nothing)
  } else {
    await unnotify(event);
  }

  const [row] = await db.select({ n: count() }).from(likes).where(eq(likes.postId, postId));
  updateTag(`likes:${postId}`);
  return { liked: removed.length === 0, count: row?.n ?? 0 };
}

export type CommentFormState =
  | { errors?: { body?: string[] }; message?: string; postedAt?: number }
  | undefined;

const commentSchema = z.object({
  postId: postIdSchema,
  body: z
    .string({ error: "Write a comment first" })
    .trim()
    .min(1, "Write a comment first")
    .max(2000, "Keep comments under 2000 characters"),
});

export async function addComment(_prev: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({ postId: formData.get("postId"), body: formData.get("body") });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };

  const { postId, body } = parsed.data;
  const authorId = await publishedAuthor(postId);
  if (authorId === null) return { message: "This post isn't accepting comments." };

  const [created] = await getDb().insert(comments).values({ postId, authorId: user.id, body }).returning({ id: comments.id });
  // Deleting the comment later cascades this notification away (comment_id foreign key).
  await notify({ recipientId: authorId, actorId: user.id, type: "comment", postId, commentId: created.id });
  updateTag(`comments:${postId}`);
  // A fresh value lets the form remount (clearing the textarea) only after a successful post.
  return { postedAt: Date.now() };
}

export async function deleteComment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = postIdSchema.safeParse(formData.get("id"));
  if (!id.success) return;

  // Ownership is part of the WHERE clause: you can only delete your own comments.
  const [deleted] = await getDb()
    .delete(comments)
    .where(and(eq(comments.id, id.data), eq(comments.authorId, user.id)))
    .returning({ postId: comments.postId });
  if (deleted) updateTag(`comments:${deleted.postId}`);
}
