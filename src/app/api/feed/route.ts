import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/lib/dal";
import { decodeFeedCursor, FEED_SORTS, getFeedPage, type FeedSort } from "@/lib/feed";
import { normalizeTag } from "@/lib/tags";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Pages 2+ of /feed (infinite scroll). Personal, so it's authenticated and never cached. */
export async function GET(request: NextRequest) {
  const viewer = await authenticate();
  if (!viewer) return bad("Sign in to see your feed.", 401);

  const params = request.nextUrl.searchParams;
  const sort = (params.get("sort") ?? "latest") as FeedSort;
  if (!FEED_SORTS.includes(sort)) return bad("Invalid sort");

  const rawTag = params.get("tag");
  const tag = rawTag ? normalizeTag(rawTag) : null;
  if (rawTag && tag !== rawTag) return bad("Invalid tag");

  const author = params.get("author");
  if (author !== null && !/^[a-z0-9_]{3,20}$/.test(author)) return bad("Invalid author");

  const cursor = decodeFeedCursor(params.get("cursor") ?? "");
  if (!cursor) return bad("Invalid cursor");

  const page = await getFeedPage(viewer.id, { sort, tag, author }, cursor);
  return NextResponse.json(page, { headers: { "Cache-Control": "private, no-store" } });
}
