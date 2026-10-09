import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, tags, userInterests } from "@/db";

/**
 * "Show me something I'll like".
 *
 * Interest profile: the tags you picked. If you haven't picked any, the tags of posts
 * you've liked stand in, so it still works from day one of liking things.
 *
 * Each candidate (published, not yours, not already liked) gets a score:
 *   2 x interest overlap          (the main signal)
 * + ln(1 + likes)                 (popular, with diminishing returns)
 * + 0.5 if you follow the author
 * + up to 1 for freshness         (fades over ~a month)
 *
 * Then a *weighted random* pick: ORDER BY -ln(random()) / score is the classic
 * Efraimidis-Spirakis sampler, so higher scores win more often but "show me another"
 * still gives variety. The randomness lives in Postgres, keeping React rendering pure.
 */

export type Pick = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  publishedAt: string;
  author: { username: string; avatarUrl: string | null };
  likes: number;
  followed: boolean;
  matched: string[]; // which of your interests it hit, for "why we picked this"
  tags: string[];
};

export type Recommendation = { basis: "interests" | "likes"; pick: Pick; more: Pick[] } | { basis: "none" | "exhausted" };

export async function getInterests(userId: number): Promise<string[]> {
  const rows = await getDb()
    .select({ name: tags.name })
    .from(userInterests)
    .innerJoin(tags, eq(tags.id, userInterests.tagId))
    .where(eq(userInterests.userId, userId))
    .orderBy(asc(tags.name));
  return rows.map((r) => r.name);
}

type Row = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  reading_minutes: number;
  published_ms: number;
  username: string;
  avatar_url: string | null;
  likes: number;
  followed: boolean;
  matched: string[] | null;
  tags: string[] | null;
  basis: "interests" | "likes";
};

export async function recommend(userId: number, skip: number[] = []): Promise<Recommendation> {
  const db = getDb();
  const skipClause = skip.length ? sql`and p.id not in (${sql.join(skip.map((id) => sql`${id}`), sql`, `)})` : sql``;

  const result = await db.execute(sql`
    with picked as (
      select tag_id, 1.0::float8 as w from user_interests where user_id = ${userId}
    ),
    from_likes as (
      select pt.tag_id, 1.0::float8 as w
        from likes l join post_tags pt on pt.post_id = l.post_id
       where l.user_id = ${userId}
       group by pt.tag_id
    ),
    profile as (
      select tag_id, w, 'interests' as basis from picked
      union all
      select tag_id, w, 'likes' as basis from from_likes where not exists (select 1 from picked)
    ),
    cand as (
      select p.id, p.slug, p.title, p.excerpt, p.reading_minutes, u.username, u.avatar_url,
             (extract(epoch from p.published_at) * 1000)::float8 as published_ms,
             (select count(*) from likes l where l.post_id = p.id)::int as likes,
             exists (select 1 from follows f where f.follower_id = ${userId} and f.following_id = p.author_id) as followed,
             (select coalesce(sum(pr.w), 0) from post_tags pt join profile pr on pr.tag_id = pt.tag_id where pt.post_id = p.id)::float8 as overlap,
             (select array_agg(t.name order by t.name) from post_tags pt join profile pr on pr.tag_id = pt.tag_id join tags t on t.id = pt.tag_id where pt.post_id = p.id) as matched,
             (select array_agg(t.name order by t.name) from post_tags pt join tags t on t.id = pt.tag_id where pt.post_id = p.id) as tags,
             extract(epoch from (now() - p.published_at)) / 86400 as age_days
        from posts p
        join users u on u.id = p.author_id
       where p.published_at is not null
         and p.author_id <> ${userId}
         and not exists (select 1 from likes l where l.post_id = p.id and l.user_id = ${userId})
         ${skipClause}
    ),
    scored as (
      select *, (2 * overlap + ln(1 + likes) + case when followed then 0.5 else 0 end + 1.0 / (1 + age_days / 30)) as score
        from cand
       where overlap > 0
    )
    select s.*, (select basis from profile limit 1) as basis
      from scored s
     order by -ln(random()) / s.score
     limit 4
  `);

  const rows = result.rows as unknown as Row[];
  if (rows.length === 0) {
    const [{ has }] = (await db.execute(sql`
      select exists (select 1 from user_interests where user_id = ${userId})
          or exists (select 1 from likes where user_id = ${userId}) as has
    `)).rows as { has: boolean }[];
    return { basis: has ? "exhausted" : "none" };
  }

  const toPick = (r: Row): Pick => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    readingMinutes: r.reading_minutes,
    publishedAt: new Date(r.published_ms).toISOString(),
    author: { username: r.username, avatarUrl: r.avatar_url },
    likes: r.likes,
    followed: r.followed,
    matched: r.matched ?? [],
    tags: r.tags ?? [],
  });
  return { basis: rows[0].basis, pick: toPick(rows[0]), more: rows.slice(1).map(toPick) };
}

/** Tags worth offering in the picker: everything that has published posts, most used first. */
export async function pickableTags(limit = 40): Promise<{ name: string; posts: number }[]> {
  const result = await getDb().execute(sql`
    select t.name, count(*)::int as posts
      from post_tags pt
      join tags t on t.id = pt.tag_id
      join posts p on p.id = pt.post_id and p.published_at is not null
     group by t.name
     order by posts desc, t.name
     limit ${limit}
  `);
  return result.rows as unknown as { name: string; posts: number }[];
}
