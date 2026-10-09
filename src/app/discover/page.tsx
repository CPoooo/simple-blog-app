import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DiscoverFeed } from "@/components/discover/discover-feed";
import { Dices, Sparkles } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFirstDiscoverPage, getPopularTags } from "@/lib/discover";
import { normalizeTag } from "@/lib/tags";

export const metadata: Metadata = { title: "Discover" };

type SearchParams = Promise<{ tag?: string | string[] }>;

export default function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-center sm:text-left text-4xl font-semibold">Discover</h1>
      <p className="mt-2 text-center sm:text-left text-muted-foreground">The best of the blog right now. Likes count most, but fresh posts get a head start.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
        <Link href="/for-you" className={buttonVariants({ variant: "outline" })}>
          <Sparkles aria-hidden /> Show me something I&apos;ll like
        </Link>
        <a href="/surprise" className={buttonVariants({ variant: "ghost" })}>
          <Dices aria-hidden /> Surprise me
        </a>
      </div>
      <Suspense fallback={<FeedSkeleton />}>
        <Discover searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Discover({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).tag;
  const requested = typeof raw === "string" ? raw : null;
  const tag = requested ? normalizeTag(requested) : null;
  // One canonical URL per filter: ?tag=Next%20JS -> ?tag=next-js
  if (requested !== null && tag !== requested) redirect(tag ? `/discover?tag=${tag}` : "/discover");

  const [page, popular] = await Promise.all([getFirstDiscoverPage(tag), getPopularTags()]);
  const chips = tag && !popular.some((t) => t.name === tag) ? [{ name: tag, posts: null }, ...popular] : popular;

  return (
    <>
      <nav aria-label="Filter by tag" className="mt-8 -mx-4 overflow-x-auto px-4 pb-2">
        <ul className="mx-auto flex w-max gap-2 sm:mx-0">
          <li>
            <Link href="/discover" aria-current={tag ? undefined : "page"} className={badgeVariants({ variant: tag ? "outline" : "default" })}>
              All
            </Link>
          </li>
          {chips.map((t) => (
            <li key={t.name}>
              <Link
                href={`/discover?tag=${t.name}`}
                aria-current={t.name === tag ? "page" : undefined}
                className={badgeVariants({ variant: t.name === tag ? "default" : "outline" })}
              >
                #{t.name}
                {t.posts !== null && <span className="opacity-60">{t.posts}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* key: switching tags remounts the feed, resetting its scroll state. */}
      <DiscoverFeed key={tag ?? "all"} initial={page} tag={tag} />
    </>
  );
}

function FeedSkeleton() {
  return (
    <div className="mt-8 grid gap-6">
      <Skeleton className="h-6 w-2/3" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
