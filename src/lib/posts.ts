import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { getDb, posts } from "@/db";

/**
 * Public read of a published post. Cached on the server (no cookies involved),
 * and invalidated by the save/publish/delete actions via updateTag(`post:${slug}`).
 */
export async function getPublishedPost(slug: string) {
  "use cache";
  cacheTag(`post:${slug}`);
  cacheLife("minutes");

  const post = await getDb().query.posts.findFirst({
    where: and(eq(posts.slug, slug), isNotNull(posts.publishedAt)),
    columns: { id: true, slug: true, title: true, content: true, excerpt: true, readingMinutes: true, publishedAt: true },
    with: { author: { columns: { id: true, username: true } } },
  });
  return post ? { ...post, content: post.content as JSONContent } : null;
}

/** The author's own post (draft or published). Authorization lives in the WHERE clause. */
export async function getOwnPost(id: number, userId: number) {
  const post = await getDb().query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.authorId, userId)),
    columns: { id: true, slug: true, title: true, content: true, publishedAt: true },
  });
  return post ? { ...post, content: post.content as JSONContent } : null;
}

export async function listOwnPosts(userId: number) {
  return getDb()
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(eq(posts.authorId, userId))
    .orderBy(desc(posts.updatedAt));
}
