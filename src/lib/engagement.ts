import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, count, eq } from "drizzle-orm";
import { comments, getDb, likes } from "@/db";

/** Public like count. Invalidated by toggleLike via updateTag(`likes:${postId}`). */
export async function getLikeCount(postId: number): Promise<number> {
  "use cache";
  cacheTag(`likes:${postId}`);
  cacheLife("minutes");

  const [row] = await getDb().select({ n: count() }).from(likes).where(eq(likes.postId, postId));
  return row?.n ?? 0;
}

/** Per-viewer, so never cached on the server. */
export async function hasLiked(postId: number, userId: number): Promise<boolean> {
  const row = await getDb().query.likes.findFirst({
    where: and(eq(likes.postId, postId), eq(likes.userId, userId)),
    columns: { postId: true },
  });
  return Boolean(row);
}

/** Public comment thread, oldest first. Invalidated by add/delete via updateTag(`comments:${postId}`). */
export async function getComments(postId: number) {
  "use cache";
  cacheTag(`comments:${postId}`);
  cacheLife("minutes");

  return getDb().query.comments.findMany({
    where: eq(comments.postId, postId),
    orderBy: asc(comments.createdAt),
    columns: { id: true, body: true, createdAt: true, authorId: true },
    with: { author: { columns: { username: true } } },
  });
}
