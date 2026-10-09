import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, postTags, tags } from "@/db";

export const FEED_PAGE_SIZE = 10;
export const FEED_SORTS = ["latest", "top"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export type FeedPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: string; // ISO, so pages serialize the same over RSC and JSON
  author: { username: string; avatarUrl: string | null };
  tags: string[];
  likes: number;
  comments: number;
  liked: boolean; // by the viewer, so the inline like button starts in the right state
};

export type FeedPage = { posts: FeedPost[]; nextCursor: string | null };
export type FeedFilters = { sort: FeedSort; tag: string | null; author: string | null };

// Keyset cursor over the exact sort key, so pages never overlap or skip:
//   latest -> (published_ms, id)      top -> (likes, published_ms, id)
const cursorSchema = z.object({ l: z.number().int().min(0).optional(), m: z.number().finite(), i: z.number().int().positive() });
type Cursor = z.infer<typeof cursorSchema>;

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");

export function decodeFeedCursor(raw: string): Cursor | null {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type Row = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  reading_minutes: number;
  username: string;
  avatar_url: string | null;
  published_ms: number;
  likes: number;
  comments: number;
  liked: boolean;
};

/**
 * One page of posts from people the viewer follows. Personal (reads the viewer's
 * follows and likes), so it's never cached on the server.
 */
export async function getFeedPage(viewerId: number, filters: FeedFilters, cursor: Cursor | null, limit = FEED_PAGE_SIZE): Promise<FeedPage> {
  const { sort, tag, author } = filters;
  const db = getDb();

  const after = !cursor
    ? sql``
    : sort === "top"
      ? sql`where (f.likes, f.published_ms, f.id) < (${cursor.l ?? 0}::int, ${cursor.m}::float8, ${cursor.i}::int)`
      : sql`where (f.published_ms, f.id) < (${cursor.m}::float8, ${cursor.i}::int)`;
  const order = sort === "top" ? sql`order by f.likes desc, f.published_ms desc, f.id desc` : sql`order by f.published_ms desc, f.id desc`;

  const result = await db.execute(sql`
    select * from (
      select
        p.id, p.slug, p.title, p.excerpt, p.reading_minutes, u.username, u.avatar_url,
        (extract(epoch from p.published_at) * 1000)::float8 as published_ms,
        coalesce(l.n, 0)::int as likes,
        coalesce(c.n, 0)::int as comments,
        exists (select 1 from likes ml where ml.post_id = p.id and ml.user_id = ${viewerId}) as liked
      from posts p
      join users u on u.id = p.author_id
      left join (select post_id, count(*) as n from likes group by post_id) l on l.post_id = p.id
      left join (select post_id, count(*) as n from comments group by post_id) c on c.post_id = p.id
      where p.published_at is not null
        and p.author_id in (select following_id from follows where follower_id = ${viewerId})
        ${author ? sql`and u.username = ${author}` : sql``}
        ${tag ? sql`and exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id and t.name = ${tag})` : sql``}
    ) f
    ${after}
    ${order}
    limit ${limit + 1}
  `);

  const rows = result.rows as unknown as Row[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  const tagRows = page.length
    ? await db
        .select({ postId: postTags.postId, name: tags.name })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(inArray(postTags.postId, page.map((r) => r.id)))
    : [];

  return {
    posts: page.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      readingMinutes: r.reading_minutes,
      publishedAt: new Date(r.published_ms).toISOString(),
      author: { username: r.username, avatarUrl: r.avatar_url },
      tags: tagRows.filter((t) => t.postId === r.id).map((t) => t.name).sort(),
      likes: r.likes,
      comments: r.comments,
      liked: r.liked,
    })),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor(sort === "top" ? { l: last.likes, m: last.published_ms, i: last.id } : { m: last.published_ms, i: last.id })
        : null,
  };
}

export type FollowedPerson = {
  id: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  posts: number;
  lastPostMs: number | null;
  lastPostTitle: string | null;
  lastPostSlug: string | null;
  /** Posted in the last 3 days: gets a ring in the feed's people strip. */
  recent: boolean;
};

/** Everyone the viewer follows, most recently active first (people who never posted last). */
export async function getFollowedPeople(viewerId: number): Promise<FollowedPerson[]> {
  const result = await getDb().execute(sql`
    select u.id, u.username, u.avatar_url as "avatarUrl", u.bio,
           count(p.id)::int as posts,
           (extract(epoch from max(p.published_at)) * 1000)::float8 as "lastPostMs",
           (array_agg(p.title order by p.published_at desc))[1] as "lastPostTitle",
           (array_agg(p.slug order by p.published_at desc))[1] as "lastPostSlug",
           coalesce(max(p.published_at) > now() - interval '3 days', false) as recent
      from follows f
      join users u on u.id = f.following_id
      left join posts p on p.author_id = u.id and p.published_at is not null
     where f.follower_id = ${viewerId}
     group by u.id
     order by max(p.published_at) desc nulls last, u.username
  `);
  return result.rows as unknown as FollowedPerson[];
}

/** Tags your people actually write about, most used first: the feed's filter chips. */
export async function getFeedTags(viewerId: number, limit = 12): Promise<{ name: string; posts: number }[]> {
  const result = await getDb().execute(sql`
    select t.name, count(*)::int as posts
      from post_tags pt
      join tags t on t.id = pt.tag_id
      join posts p on p.id = pt.post_id and p.published_at is not null
     where p.author_id in (select following_id from follows where follower_id = ${viewerId})
     group by t.name
     order by posts desc, t.name
     limit ${limit}
  `);
  return result.rows as unknown as { name: string; posts: number }[];
}
