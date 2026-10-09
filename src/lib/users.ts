import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { follows, getDb, posts, users } from "@/db";

const tagNames = { postTags: { with: { tag: { columns: { name: true } } } } } as const;
const cardColumns = { id: true, slug: true, title: true, excerpt: true, readingMinutes: true, publishedAt: true } as const;

function flattenTags<T extends { postTags: { tag: { name: string } }[] }>(row: T) {
  const { postTags: links, ...rest } = row;
  return { ...rest, tags: links.map((l) => l.tag.name).sort() };
}

/**
 * Public profile + counts. Tagged so a rename/bio edit (user:id), a follow
 * (follows:id), or a new account claiming the name (username:name) refreshes it.
 */
export async function getProfile(username: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`username:${username}`);

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, username: true, bio: true, avatarUrl: true, createdAt: true },
  });
  if (!user) return null;
  cacheTag(`user:${user.id}`, `follows:${user.id}`);

  const [[postCount], [followers], [following]] = await Promise.all([
    db.select({ n: count() }).from(posts).where(and(eq(posts.authorId, user.id), isNotNull(posts.publishedAt))),
    db.select({ n: count() }).from(follows).where(eq(follows.followingId, user.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, user.id)),
  ]);
  return { ...user, posts: postCount.n, followers: followers.n, following: following.n };
}

export async function listPublishedByAuthor(authorId: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user:${authorId}`);

  const rows = await getDb().query.posts.findMany({
    where: and(eq(posts.authorId, authorId), isNotNull(posts.publishedAt)),
    orderBy: desc(posts.publishedAt),
    limit: 50,
    columns: cardColumns,
    with: { author: { columns: { username: true } }, ...tagNames },
  });
  return rows.map(flattenTags);
}

/** Per-viewer, never cached on the server. */
export async function isFollowing(followerId: number, followingId: number) {
  const row = await getDb().query.follows.findFirst({
    where: and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)),
    columns: { followerId: true },
  });
  return Boolean(row);
}

/** Newest posts from people you follow. Personal, so it's read fresh on each request. */
export async function getFeed(userId: number, limit = 30) {
  const db = getDb();
  const followed = db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId));
  const rows = await db.query.posts.findMany({
    where: and(isNotNull(posts.publishedAt), inArray(posts.authorId, followed)),
    orderBy: desc(posts.publishedAt),
    limit,
    columns: cardColumns,
    with: { author: { columns: { username: true } }, ...tagNames },
  });
  return rows.map(flattenTags);
}

/** People you don't follow yet, best writers first (published posts, then likes received). */
export async function getSuggestions(userId: number, limit = 5) {
  const result = await getDb().execute(sql`
    select u.id, u.username, u.bio, u.avatar_url as "avatarUrl",
           count(distinct p.id)::int as posts,
           count(l.post_id)::int as likes
      from users u
      join posts p on p.author_id = u.id and p.published_at is not null
      left join likes l on l.post_id = p.id
     where u.id <> ${userId}
       and u.id not in (select following_id from follows where follower_id = ${userId})
     group by u.id
     order by posts desc, likes desc, u.username
     limit ${limit}
  `);
  return result.rows as { id: number; username: string; bio: string | null; avatarUrl: string | null; posts: number; likes: number }[];
}
