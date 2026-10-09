import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FollowButton } from "@/components/follow-button";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/dal";
import { getFollowedPeople } from "@/lib/feed";

export const metadata: Metadata = { title: "Following" };

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function FollowingPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-center text-4xl font-semibold sm:text-left">Following</h1>
      <p className="mt-2 text-center text-muted-foreground sm:text-left">Everyone you follow, most recently active first.</p>
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full" />}>
        <People />
      </Suspense>
    </main>
  );
}

async function People() {
  const user = await requireUser();
  const people = await getFollowedPeople(user.id);

  if (people.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
        <p className="font-heading text-xl">You&apos;re not following anyone yet.</p>
        <Link href="/discover" className={buttonVariants({ className: "mt-5" })}>
          Find people on Discover
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 divide-y border-y">
      {people.map((p) => (
        <li key={p.id} className="flex items-start gap-4 py-5">
          <Link href={`/u/${p.username}`} tabIndex={-1} aria-hidden>
            <UserAvatar username={p.username} src={p.avatarUrl} className="size-12 text-xl" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/u/${p.username}`} className="font-medium hover:underline">
              @{p.username}
            </Link>
            {p.bio && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.bio}</p>}
            <p className="mt-2 text-sm text-muted-foreground">
              {p.posts} {p.posts === 1 ? "post" : "posts"}
              {p.lastPostSlug && p.lastPostMs !== null && (
                <>
                  {" · latest: "}
                  <Link href={`/p/${p.lastPostSlug}`} className="text-foreground hover:underline">
                    {p.lastPostTitle}
                  </Link>{" "}
                  ({when.format(new Date(p.lastPostMs))})
                </>
              )}
            </p>
            <Link href={`/feed?author=${p.username}`} className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">
              See their posts in your feed →
            </Link>
          </div>
          <FollowButton userId={p.id} username={p.username} initial={{ following: true, followers: 0 }} signedIn size="sm" />
        </li>
      ))}
    </ul>
  );
}
