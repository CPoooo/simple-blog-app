import { NextResponse, type NextRequest } from "next/server";
import { decodeCursor, getDiscoverPage } from "@/lib/discover";
import { normalizeTag } from "@/lib/tags";

const DAY = 24 * 60 * 60 * 1000;
const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });

/** Pages 2+ of /discover (infinite scroll). Public data only, so no session is read. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const rawTag = params.get("tag");
  const tag = rawTag ? normalizeTag(rawTag) : null;
  if (rawTag && tag !== rawTag) return bad("Invalid tag");

  const cursor = decodeCursor(params.get("cursor") ?? "");
  if (!cursor) return bad("Invalid cursor");

  // asOf pins the ranking clock for one scroll session; reject anything that isn't plausibly ours.
  const asOf = new Date(params.get("asOf") ?? "");
  const now = Date.now();
  if (Number.isNaN(asOf.getTime()) || asOf.getTime() > now + 60_000 || asOf.getTime() < now - DAY) {
    return bad("Invalid asOf");
  }

  const { page } = await getDiscoverPage({ tag, cursor, asOf });
  return NextResponse.json(page, { headers: { "Cache-Control": "public, max-age=60" } });
}
