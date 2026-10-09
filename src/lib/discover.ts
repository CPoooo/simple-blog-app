import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, postTags, posts, tags } from "@/db";

export const DISCOVER_PAGE_SIZE = 10;

/**
 * Hacker News style ranking: likes, divided by age (in hours) raised to GRAVITY.
 * Higher gravity = old posts sink faster. Posts with no likes score 0 and fall
 * back to newest-first underneath the liked ones.
 */
const GRAVITY = 1.5;

export type DiscoverPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: string; // ISO, so pages serialize the same over RSC and JSON
  author: { username: string };
  tags: string[];
  likes: number;
  comments: number;
};

export type DiscoverPage = { posts: DiscoverPost[]; nextCursor: string | null; asOf: string };

// Keyset cursor over the exact sort key (score, published time, id), so pages never overlap or skip.
const cursorSchema = z.object({ s: z.number().finite().min(0), m: z.number().finite(), i: z.number().int().positive() });
type Cursor = z.infer<typeof cursorSchema>;

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type Row = {
  id: number;
  author_id: number;
  slug: string;
  title: string;
  excerpt: string;
  reading_minutes: number;
  username: string;
  published_ms: number;
  likes: number;
  comments: number;
  score: number;
};

/**
 * One page of ranked posts. `asOf` freezes "now" for a whole scroll session: every
 * page scores posts against the same instant, so the order can't shift between pages.
 */
export async function getDiscoverPage(opts: { tag: string | null; cursor: Cursor | null; asOf: Date; limit?: number }) {
  const { tag, cursor, asOf, limit = DISCOVER_PAGE_SIZE } = opts;
  const at = asOf.toISOString();
  const db = getDb();

  const result = await db.execute(sql`
    select * from (
      select
        p.id, p.author_id, p.slug, p.title, p.excerpt, p.reading_minutes, u.username,
        (extract(epoch from p.published_at) * 1000)::float8 as published_ms,
        coalesce(l.n, 0)::int as likes,
        coalesce(c.n, 0)::int as comments,
        (coalesce(l.n, 0) / power(greatest(extract(epoch from (${at}::timestamp - p.published_at)) / 3600, 0) + 2, ${GRAVITY}))::float8 as score
      from posts p
      join users u on u.id = p.author_id
      left join (select post_id, count(*) as n from likes group by post_id) l on l.post_id = p.id
      left join (select post_id, count(*) as n from comments group by post_id) c on c.post_id = p.id
      where p.published_at is not null
        and p.published_at <= ${at}::timestamp
        ${tag ? sql`and exists (select 1 from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id and t.name = ${tag})` : sql``}
    ) ranked
    ${cursor ? sql`where (ranked.score, ranked.published_ms, ranked.id) < (${cursor.s}::float8, ${cursor.m}::float8, ${cursor.i}::int)` : sql``}
    order by ranked.score desc, ranked.published_ms desc, ranked.id desc
    limit ${limit + 1}
  `);

  const rows = result.rows as unknown as Row[];
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);

  const tagRows = pageRows.length
    ? await db
        .select({ postId: postTags.postId, name: tags.name })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(inArray(postTags.postId, pageRows.map((r) => r.id)))
    : [];

  const page: DiscoverPage = {
    posts: pageRows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      readingMinutes: r.reading_minutes,
      publishedAt: new Date(r.published_ms).toISOString(),
      author: { username: r.username },
      tags: tagRows.filter((t) => t.postId === r.id).map((t) => t.name).sort(),
      likes: r.likes,
      comments: r.comments,
    })),
    nextCursor: rows.length > limit && last ? encodeCursor({ s: last.score, m: last.published_ms, i: last.id }) : null,
    asOf: at,
  };
  return { page, authorIds: [...new Set(pageRows.map((r) => r.author_id))] };
}

/** First page, rendered on the server and cached briefly; later pages come from /api/discover. */
export async function getFirstDiscoverPage(tag: string | null): Promise<DiscoverPage> {
  "use cache";
  cacheTag("discover");
  cacheLife("minutes");

  const { page, authorIds } = await getDiscoverPage({ tag, cursor: null, asOf: new Date() });
  // Renaming a user must refresh any cached page showing their name.
  if (authorIds.length) cacheTag(...authorIds.map((id) => `user:${id}`));
  return page;
}

/** Tags with the most published posts, for the filter chips. */
export async function getPopularTags(limit = 12) {
  "use cache";
  cacheTag("tags");
  cacheLife("minutes");

  return getDb()
    .select({ name: tags.name, posts: count() })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .innerJoin(posts, eq(posts.id, postTags.postId))
    .where(isNotNull(posts.publishedAt))
    .groupBy(tags.name)
    .orderBy(desc(count()), asc(tags.name))
    .limit(limit);
}
