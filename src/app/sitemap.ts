import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { eq, isNotNull, max } from "drizzle-orm";
import { getDb, posts, users } from "@/db";
import { getPopularTags } from "@/lib/discover";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheTag("discover");
  cacheLife("hours");

  const db = getDb();
  const [published, authors, topics] = await Promise.all([
    db.select({ slug: posts.slug, updatedAt: posts.updatedAt }).from(posts).where(isNotNull(posts.publishedAt)),
    // Only people who've published something get a sitemap entry.
    db
      .select({ username: users.username, last: max(posts.publishedAt) })
      .from(users)
      .innerJoin(posts, eq(posts.authorId, users.id))
      .where(isNotNull(posts.publishedAt))
      .groupBy(users.username),
    getPopularTags(100),
  ]);

  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/discover"), changeFrequency: "hourly", priority: 0.9 },
    ...published.map((p) => ({ url: absoluteUrl(`/p/${p.slug}`), lastModified: p.updatedAt, priority: 0.8 })),
    ...authors.map((a) => ({ url: absoluteUrl(`/u/${a.username}`), lastModified: a.last ?? undefined, priority: 0.5 })),
    ...topics.map((t) => ({ url: absoluteUrl(`/tag/${t.name}`), priority: 0.4 })),
  ];
}
