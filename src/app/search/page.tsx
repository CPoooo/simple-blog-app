import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { searchPeople, searchPosts } from "@/lib/search";

export const metadata: Metadata = { title: "Search" };

type SearchParams = Promise<{ q?: string | string[] }>;

const clean = (raw: string | string[] | undefined) => (typeof raw === "string" ? raw.trim().slice(0, 100) : "");

export default function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-4xl font-semibold">Search</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-10 w-full" />}>
        <SearchForm searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Skeleton className="mt-10 h-48 w-full" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/** A plain GET form: works without JavaScript, and every search has a shareable URL. */
async function SearchForm({ searchParams }: { searchParams: SearchParams }) {
  const q = clean((await searchParams).q);
  return (
    <form action="/search" role="search" className="mt-8 flex gap-2">
      <label htmlFor="q" className="sr-only">
        Search posts, tags, and people
      </label>
      <Input id="q" name="q" type="search" defaultValue={q} placeholder="rust, spin rate, consciousness…" maxLength={100} className="h-10" autoFocus={!q} />
      <Button type="submit" size="lg" className="h-10">
        <Search aria-hidden />
        Search
      </Button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: SearchParams }) {
  const q = clean((await searchParams).q);
  if (q.length < 2) {
    return <p className="mt-10 font-hand text-2xl text-primary">type something, then fall in</p>;
  }

  const [found, people] = await Promise.all([searchPosts(q), searchPeople(q)]);

  if (found.length === 0 && people.length === 0) {
    return (
      <p className="mt-10 text-muted-foreground">
        Nothing for &ldquo;{q}&rdquo;. Either nobody&apos;s written about it yet, or you should.
      </p>
    );
  }

  return (
    <div className="mt-10 grid gap-10">
      {people.length > 0 && (
        <section aria-labelledby="people-heading">
          <h2 id="people-heading" className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            People
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {people.map((p) => (
              <li key={p.id}>
                <Link href={`/u/${p.username}`} className="flex items-center gap-3 rounded-lg p-2 -m-2 hover:bg-muted/60">
                  <UserAvatar username={p.username} />
                  <span className="min-w-0">
                    <span className="block font-medium">@{p.username}</span>
                    {p.bio && <span className="block truncate text-sm text-muted-foreground">{p.bio}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {found.length > 0 && (
        <section aria-labelledby="posts-heading">
          <h2 id="posts-heading" className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Posts
          </h2>
          <div className="divide-y">
            {found.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
