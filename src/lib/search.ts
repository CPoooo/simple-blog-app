import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, exists, ilike, isNotNull, or, eq } from "drizzle-orm";
import { getDb, postTags, posts, tags, users } from "@/db";

/** Treat the query as literal text: %, _ and \ are wildcards/escapes in LIKE patterns. */
const pattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function searchPosts(q: string) {
  "use cache";
  cacheTag("discover");
  cacheLife("minutes");

  const db = getDb();
  const p = pattern(q);
  const tagMatch = db
    .select({ one: postTags.postId })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(and(eq(postTags.postId, posts.id), ilike(tags.name, p)));

  const rows = await db.query.posts.findMany({
    where: and(isNotNull(posts.publishedAt), or(ilike(posts.title, p), ilike(posts.excerpt, p), exists(tagMatch))),
    orderBy: desc(posts.publishedAt),
    limit: 20,
    columns: { id: true, slug: true, title: true, excerpt: true, readingMinutes: true, publishedAt: true },
    with: { author: { columns: { username: true } }, postTags: { with: { tag: { columns: { name: true } } } } },
  });
  return rows.map(({ postTags: links, ...r }) => ({ ...r, tags: links.map((l) => l.tag.name).sort() }));
}

export async function searchPeople(q: string) {
  "use cache";
  cacheLife("minutes");

  const p = pattern(q);
  return getDb()
    .select({ id: users.id, username: users.username, bio: users.bio })
    .from(users)
    .where(or(ilike(users.username, p), ilike(users.bio, p)))
    .orderBy(users.username)
    .limit(8);
}
