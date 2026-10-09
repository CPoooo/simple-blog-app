import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, count, desc, eq } from "drizzle-orm";
import { bookmarks, comments, getDb, likes } from "@/db";

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

/** Per-viewer, so never cached on the server. */
export async function isBookmarked(userId: number, postId: number): Promise<boolean> {
  const row = await getDb().query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)),
    columns: { postId: true },
  });
  return Boolean(row);
}

/** Your reading list: saved posts that are still published, most recently saved first. */
export async function listBookmarks(userId: number) {
  const rows = await getDb().query.bookmarks.findMany({
    where: eq(bookmarks.userId, userId),
    orderBy: desc(bookmarks.createdAt),
    limit: 100,
    with: {
      post: {
        columns: { id: true, slug: true, title: true, excerpt: true, readingMinutes: true, publishedAt: true },
        with: { author: { columns: { username: true } }, postTags: { with: { tag: { columns: { name: true } } } } },
      },
    },
  });
  // A saved post that was later moved back to drafts disappears from the list (but stays saved).
  return rows
    .filter((r) => r.post.publishedAt !== null)
    .map(({ post: { postTags: links, ...post } }) => ({ ...post, tags: links.map((l) => l.tag.name).sort() }));
}

/** Public comment thread, oldest first. Invalidated by add/delete via updateTag(`comments:${postId}`). */
export async function getComments(postId: number) {
  "use cache";
  cacheTag(`comments:${postId}`);
  cacheLife("minutes");

  const thread = await getDb().query.comments.findMany({
    where: eq(comments.postId, postId),
    orderBy: asc(comments.createdAt),
    columns: { id: true, body: true, createdAt: true, authorId: true },
    with: { author: { columns: { username: true, avatarUrl: true } } },
  });
  // A commenter renaming themselves must refresh threads showing their old name.
  const authorIds = [...new Set(thread.map((c) => c.authorId))];
  if (authorIds.length) cacheTag(...authorIds.map((id) => `user:${id}`));
  return thread;
}
