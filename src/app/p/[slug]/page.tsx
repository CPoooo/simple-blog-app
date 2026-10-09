import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { PostComments, PostLikes } from "@/components/post/engagement";
import { ReadingProgress } from "@/components/post/reading-progress";
import { TagList } from "@/components/tag-list";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/dal";
import { getPublishedPost } from "@/lib/posts";
import { renderPostHtml } from "@/lib/post-content";
import { isFollowing } from "@/lib/users";

type Params = Promise<{ slug: string }>;

// Link previews (Slack, iMessage, X). The data call is the same cached one the page uses.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.excerpt,
    authors: [{ name: `@${post.author.username}`, url: `/u/${post.author.username}` }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt?.toISOString(),
      authors: [`@${post.author.username}`],
      tags: post.tags,
    },
  };
}

export default function PostPage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <ReadingProgress />
      <Suspense fallback={<PostSkeleton />}>
        <Post params={params} />
      </Suspense>
    </main>
  );
}

async function Post({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const published = post.publishedAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(post.publishedAt)
    : null;
  const profile = `/u/${post.author.username}`;

  return (
    <article>
      <header className="mb-10 text-center sm:text-left">
        <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{post.title}</h1>
        <div className="mt-6 flex items-center justify-center gap-3 text-left text-sm sm:justify-start">
          <Link href={profile} tabIndex={-1} aria-hidden>
            <UserAvatar username={post.author.username} src={post.author.avatarUrl} />
          </Link>
          <div>
            <Link href={profile} className="font-medium hover:underline">
              @{post.author.username}
            </Link>
            <p className="text-muted-foreground">
              {published}
              {published && " · "}
              {post.readingMinutes} min read
            </p>
          </div>
        </div>
      </header>
      {/* HTML is generated from a schema-validated Tiptap document, never raw user HTML. */}
      <div className="prose-post" dangerouslySetInnerHTML={{ __html: renderPostHtml(post.content) }} />
      <footer className="mt-12 flex flex-col items-center gap-4 border-t pt-6 sm:flex-row sm:flex-wrap sm:justify-between">
        <TagList tags={post.tags} />
        {/* Session-dependent bits stream in on their own; the article never waits for them. */}
        <Suspense fallback={<Skeleton className="h-8 w-16" />}>
          <PostLikes postId={post.id} />
        </Suspense>
      </footer>
      <aside aria-label="About the author" className="mt-10 flex flex-col items-center gap-4 rounded-xl bg-muted/50 p-5 text-center sm:flex-row sm:items-start sm:text-left">
        <UserAvatar username={post.author.username} src={post.author.avatarUrl} className="size-12 text-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Written by</p>
          <Link href={profile} className="font-heading text-lg font-semibold hover:underline">
            @{post.author.username}
          </Link>
          {post.author.bio && <p className="mt-1 text-sm leading-6 text-muted-foreground">{post.author.bio}</p>}
        </div>
        <Suspense fallback={null}>
          <AuthorFollow authorId={post.author.id} username={post.author.username} />
        </Suspense>
      </aside>
      <Suspense fallback={<Skeleton className="mt-12 h-40 w-full" />}>
        <PostComments postId={post.id} />
      </Suspense>
    </article>
  );
}

/** Follow button in the author box; hidden on your own posts. */
async function AuthorFollow({ authorId, username }: { authorId: number; username: string }) {
  const viewer = await getCurrentUser();
  if (viewer?.id === authorId) return null;
  const following = viewer ? await isFollowing(viewer.id, authorId) : false;
  return <FollowButton userId={authorId} username={username} initial={{ following, followers: 0 }} signedIn={viewer !== null} size="sm" />;
}

function PostSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-6 h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}
