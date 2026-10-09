import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FeedStream } from "@/components/feed/feed-stream";
import { FollowButton } from "@/components/follow-button";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/dal";
import { FEED_SORTS, getFeedPage, getFeedTags, getFollowedPeople, type FeedFilters, type FeedSort } from "@/lib/feed";
import { normalizeTag } from "@/lib/tags";
import { getSuggestions } from "@/lib/users";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your feed" };

type SearchParams = Promise<{ sort?: string | string[]; tag?: string | string[]; author?: string | string[] }>;

/** Unknown or malformed filter values fall back to "no filter" instead of erroring. */
async function readFilters(searchParams: SearchParams): Promise<FeedFilters> {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const sort = one(sp.sort);
  const tag = one(sp.tag);
  const author = one(sp.author);
  return {
    sort: FEED_SORTS.includes(sort as FeedSort) ? (sort as FeedSort) : "latest",
    tag: tag && normalizeTag(tag) === tag ? tag : null,
    author: author && /^[a-z0-9_]{3,20}$/.test(author) ? author : null,
  };
}

/** Builds a /feed URL that changes one filter and keeps the others. */
function feedHref(filters: FeedFilters, change: Partial<FeedFilters>) {
  const next = { ...filters, ...change };
  const qs = new URLSearchParams();
  if (next.sort !== "latest") qs.set("sort", next.sort);
  if (next.tag) qs.set("tag", next.tag);
  if (next.author) qs.set("author", next.author);
  const s = qs.toString();
  return s ? `/feed?${s}` : "/feed";
}

export default function FeedPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section aria-labelledby="feed-heading" className="min-w-0">
        <h1 id="feed-heading" className="text-center text-4xl font-semibold sm:text-left">
          Your feed
        </h1>
        <Suspense fallback={<FeedSkeleton />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </section>
      <aside aria-labelledby="suggest-heading" className="lg:pt-16">
        <h2 id="suggest-heading" className="text-center font-hand text-2xl text-primary sm:text-left">
          worth following
        </h2>
        <Suspense fallback={<Skeleton className="mt-4 h-48 w-full" />}>
          <Suggestions />
        </Suspense>
      </aside>
    </main>
  );
}

async function Feed({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const filters = await readFilters(searchParams);
  const [people, topics, page] = await Promise.all([
    getFollowedPeople(user.id),
    getFeedTags(user.id),
    getFeedPage(user.id, filters, null),
  ]);

  if (people.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
        <p className="font-heading text-xl">It&apos;s quiet down here.</p>
        <p className="mt-2 text-muted-foreground">Follow a few people and their new posts will land here.</p>
        <Link href="/discover" className={buttonVariants({ className: "mt-5" })}>
          Find people on Discover
        </Link>
      </div>
    );
  }

  const filtered = filters.tag !== null || filters.author !== null;

  return (
    <>
      {/* People you follow, like story bubbles: tap one to see just their posts. */}
      <nav aria-label="Filter by person" className="mt-6 -mx-4 overflow-x-auto px-4 pb-2">
        <ul className="flex w-max gap-4">
          <li>
            <Link href={feedHref(filters, { author: null })} aria-current={filters.author ? undefined : "page"} className="grid w-16 justify-items-center gap-1.5 text-xs">
              <span className={cn("grid size-14 place-items-center rounded-full border-2 font-heading text-sm font-semibold", filters.author ? "border-border" : "border-primary bg-primary text-primary-foreground")}>
                All
              </span>
              <span className="text-muted-foreground">Everyone</span>
            </Link>
          </li>
          {people.map((p) => {
            const active = filters.author === p.username;
            const recent = p.recent; // computed in SQL: rendering stays pure
            return (
              <li key={p.id}>
                <Link
                  href={feedHref(filters, { author: active ? null : p.username })}
                  aria-current={active ? "page" : undefined}
                  aria-label={`${active ? "Show everyone" : `Only @${p.username}`}${recent ? " (posted recently)" : ""}`}
                  className="grid w-16 justify-items-center gap-1.5 text-xs"
                >
                  <span className={cn("rounded-full p-0.5 ring-2", active ? "ring-foreground" : recent ? "ring-primary" : "ring-transparent")}>
                    <UserAvatar username={p.username} src={p.avatarUrl} className="size-12 text-lg" />
                  </span>
                  <span className={cn("max-w-16 truncate", active ? "font-medium" : "text-muted-foreground")}>{p.username}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/following" className="grid w-16 justify-items-center gap-1.5 text-xs">
              <span className="grid size-14 place-items-center rounded-full border-2 border-dashed text-muted-foreground">→</span>
              <span className="text-muted-foreground">See all</span>
            </Link>
          </li>
        </ul>
      </nav>

      {/* Sort tabs + tag chips. Plain links: every filter combo is a shareable URL. */}
      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div role="tablist" aria-label="Sort" className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
          {(["latest", "top"] as const).map((s) => (
            <Link
              key={s}
              role="tab"
              aria-selected={filters.sort === s}
              href={feedHref(filters, { sort: s })}
              className={cn("rounded-md px-3 py-1.5", filters.sort === s ? "bg-background font-medium shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}
            >
              {s === "latest" ? "Latest" : "Most liked"}
            </Link>
          ))}
        </div>
        {filtered && (
          <Link href={feedHref(filters, { tag: null, author: null })} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            Clear filters
          </Link>
        )}
      </div>
      {topics.length > 0 && (
        <nav aria-label="Filter by tag" className="mt-3 -mx-4 overflow-x-auto px-4 pb-1">
          <ul className="mx-auto flex w-max gap-1.5 sm:mx-0">
            {topics.map((t) => {
              const active = filters.tag === t.name;
              return (
                <li key={t.name}>
                  <Link
                    href={feedHref(filters, { tag: active ? null : t.name })}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full border px-3 text-xs",
                      active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    #{t.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <div className="mt-4">
        {page.posts.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            {filtered ? "Nothing matches those filters yet." : "The people you follow haven't published anything yet."}
          </p>
        ) : (
          // key: changing any filter remounts the stream, resetting its scroll state.
          <FeedStream key={feedHref(filters, {})} initial={page} filters={filters} />
        )}
      </div>
    </>
  );
}

async function Suggestions() {
  const user = await requireUser();
  const people = await getSuggestions(user.id);
  if (people.length === 0) return <p className="mt-3 text-center text-sm text-muted-foreground sm:text-left">You follow everyone worth following. Respect.</p>;

  return (
    <ul className="mt-4 grid gap-5">
      {people.map((p) => (
        <li key={p.id} className="grid gap-2">
          <div className="flex items-center gap-3">
            <UserAvatar username={p.username} src={p.avatarUrl} />
            <div className="min-w-0 flex-1">
              <Link href={`/u/${p.username}`} className="block truncate font-medium hover:underline">
                @{p.username}
              </Link>
              <p className="text-xs text-muted-foreground">
                {p.posts} {p.posts === 1 ? "post" : "posts"} · {p.likes} likes
              </p>
            </div>
            <FollowButton userId={p.id} username={p.username} initial={{ following: false, followers: 0 }} signedIn size="sm" />
          </div>
          {p.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{p.bio}</p>}
        </li>
      ))}
    </ul>
  );
}

function FeedSkeleton() {
  return (
    <div className="mt-6 grid gap-6">
      <div className="flex gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="size-14 rounded-full" />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
