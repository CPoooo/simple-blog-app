import { NextResponse, connection, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/**
 * "Surprise me": redirect to a random published post. Skips the post you're already
 * on (read from the Referer), so clicking it twice in a row always moves you.
 */
export async function GET(request: NextRequest) {
  await connection(); // per-request: a cached "random" post would be the same for everyone

  let current: string | null = null;
  try {
    const referer = new URL(request.headers.get("referer") ?? "");
    const m = referer.origin === request.nextUrl.origin ? referer.pathname.match(/^\/p\/([^/]+)$/) : null;
    current = m ? decodeURIComponent(m[1]) : null;
  } catch {}

  const result = await getDb().execute(sql`
    select slug from posts
     where published_at is not null ${current ? sql`and slug <> ${current}` : sql``}
     order by random()
     limit 1
  `);
  const slug = (result.rows[0] as { slug: string } | undefined)?.slug;

  const res = NextResponse.redirect(new URL(slug ? `/p/${slug}` : "/discover", request.nextUrl), 307);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
