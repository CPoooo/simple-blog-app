import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { getDb, postTags, posts, tags } from "@/db";

const tagNames = { postTags: { with: { tag: { columns: { name: true } } } } } as const;

function flattenTags<T extends { postTags: { tag: { name: string } }[] }>(row: T) {
  const { postTags: links, ...rest } = row;
  return { ...rest, tags: links.map((l) => l.tag.name).sort() };
}

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
    with: { author: { columns: { id: true, username: true } }, ...tagNames },
  });
  return post ? { ...flattenTags(post), content: post.content as JSONContent } : null;
}

/** The author's own post (draft or published). Authorization lives in the WHERE clause. */
export async function getOwnPost(id: number, userId: number) {
  const post = await getDb().query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.authorId, userId)),
    columns: { id: true, slug: true, title: true, content: true, publishedAt: true },
    with: tagNames,
  });
  return post ? { ...flattenTags(post), content: post.content as JSONContent } : null;
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

/** Published posts carrying a tag, newest first. Invalidated when any post using the tag changes. */
export async function listPublishedByTag(name: string, limit = 30) {
  "use cache";
  cacheTag(`tag:${name}`);
  cacheLife("minutes");

  const db = getDb();
  const withTag = db
    .select({ id: postTags.postId })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(tags.name, name));

  const rows = await db.query.posts.findMany({
    where: and(isNotNull(posts.publishedAt), inArray(posts.id, withTag)),
    orderBy: desc(posts.publishedAt),
    limit,
    columns: { id: true, slug: true, title: true, excerpt: true, readingMinutes: true, publishedAt: true },
    with: { author: { columns: { username: true } }, ...tagNames },
  });
  return rows.map(flattenTags);
}

export type PostSummary = Awaited<ReturnType<typeof listPublishedByTag>>[number];
