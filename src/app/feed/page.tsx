import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FollowButton } from "@/components/follow-button";
import { PostCard } from "@/components/post-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/dal";
import { getFeed, getSuggestions } from "@/lib/users";

export const metadata: Metadata = { title: "Your feed" };

export default function FeedPage() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section aria-labelledby="feed-heading">
        <h1 id="feed-heading" className="text-center sm:text-left text-4xl font-semibold">
          Your feed
        </h1>
        <p className="mt-2 text-center sm:text-left text-muted-foreground">New posts from the people you follow, newest first.</p>
        <Suspense fallback={<FeedSkeleton />}>
          <Feed />
        </Suspense>
      </section>
      <aside aria-labelledby="suggest-heading" className="lg:pt-24">
        <h2 id="suggest-heading" className="text-center sm:text-left font-hand text-2xl text-primary">
          worth following
        </h2>
        <Suspense fallback={<Skeleton className="mt-4 h-48 w-full" />}>
          <Suggestions />
        </Suspense>
      </aside>
    </main>
  );
}

async function Feed() {
  const user = await requireUser();
  const posts = await getFeed(user.id);

  if (posts.length === 0) {
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

  return (
    <div className="mt-6 divide-y border-t">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

async function Suggestions() {
  const user = await requireUser();
  const people = await getSuggestions(user.id);
  if (people.length === 0) return <p className="mt-3 text-sm text-muted-foreground">You follow everyone worth following. Respect.</p>;

  return (
    <ul className="mt-4 grid gap-5">
      {people.map((p) => (
        <li key={p.id} className="grid gap-2">
          <div className="flex items-center gap-3">
            <UserAvatar username={p.username} />
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
    <div className="mt-8 grid gap-8">
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
