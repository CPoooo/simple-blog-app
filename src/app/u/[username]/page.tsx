import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { PostCard } from "@/components/post-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/dal";
import { getProfile, isFollowing, listPublishedByAuthor } from "@/lib/users";

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const profile = await getProfile(decodeURIComponent((await params).username));
  if (!profile) return { title: "Not found" };
  return {
    title: `@${profile.username}`,
    description: profile.bio ?? `Posts by @${profile.username}`,
    openGraph: { title: `@${profile.username}`, description: profile.bio ?? undefined, type: "profile" },
  };
}

const joined = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export default function ProfilePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <Suspense fallback={<ProfileSkeleton />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: Params }) {
  const username = decodeURIComponent((await params).username);
  const profile = await getProfile(username);
  if (!profile) notFound();
  const posts = await listPublishedByAuthor(profile.id);

  return (
    <>
      <header className="grid gap-5 border-b pb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <UserAvatar username={profile.username} className="size-16 text-3xl" />
            <div>
              <h1 className="text-3xl font-semibold">@{profile.username}</h1>
              <p className="text-sm text-muted-foreground">Joined {joined.format(profile.createdAt)}</p>
            </div>
          </div>
          <Suspense fallback={<Skeleton className="h-8 w-20" />}>
            <ProfileAction userId={profile.id} username={profile.username} followers={profile.followers} />
          </Suspense>
        </div>
        {profile.bio && <p className="max-w-prose leading-7">{profile.bio}</p>}
        <dl className="flex gap-6 text-sm">
          {[
            ["posts", profile.posts],
            ["followers", profile.followers],
            ["following", profile.following],
          ].map(([label, n]) => (
            <div key={label} className="flex gap-1.5">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="font-semibold">{n}</span> <span className="text-muted-foreground">{label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {posts.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">No published posts yet. The hole is still being dug.</p>
      ) : (
        <div className="divide-y">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </>
  );
}

/** Follow for other people, "Edit profile" on your own page. Reads the session, so it streams separately. */
async function ProfileAction({ userId, username, followers }: { userId: number; username: string; followers: number }) {
  const viewer = await getCurrentUser();
  if (viewer?.id === userId) {
    return (
      <Link href="/settings/profile" className={buttonVariants({ variant: "outline" })}>
        Edit profile
      </Link>
    );
  }
  const following = viewer ? await isFollowing(viewer.id, userId) : false;
  return <FollowButton userId={userId} username={username} initial={{ following, followers }} signedIn={viewer !== null} />;
}

function ProfileSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
