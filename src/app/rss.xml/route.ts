import { cacheLife, cacheTag } from "next/cache";
import { desc, isNotNull } from "drizzle-orm";
import { getDb, posts } from "@/db";
import { absoluteUrl, site } from "@/lib/site";

const escape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

async function buildFeed() {
  "use cache";
  cacheTag("discover");
  cacheLife("hours");

  const latest = await getDb().query.posts.findMany({
    where: isNotNull(posts.publishedAt),
    orderBy: desc(posts.publishedAt),
    limit: 30,
    columns: { slug: true, title: true, excerpt: true, publishedAt: true },
    with: { author: { columns: { username: true } } },
  });

  const items = latest
    .map((p) => {
      const url = absoluteUrl(`/p/${p.slug}`);
      return `    <item>
      <title>${escape(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <dc:creator>@${escape(p.author.username)}</dc:creator>
      <pubDate>${p.publishedAt!.toUTCString()}</pubDate>
      <description>${escape(p.excerpt)}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(site.name)}</title>
    <link>${site.url}</link>
    <description>${escape(site.description)}</description>
    <language>en-us</language>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

export async function GET() {
  return new Response(await buildFeed(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
