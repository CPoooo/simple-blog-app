import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DeletePostButton } from "@/components/editor/delete-post-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { listOwnPosts } from "@/lib/posts";

export const metadata: Metadata = { title: "My posts" };

export default function MyPostsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">My posts</h1>
        <Link href="/write" className={buttonVariants()}>
          New post
        </Link>
      </div>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <PostList />
      </Suspense>
    </main>
  );
}

async function PostList() {
  const user = await requireUser();
  const mine = await listOwnPosts(user.id);

  if (mine.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Nothing here yet. Your first post is one click away.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {mine.map((post) => (
        <li key={post.id} className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={post.publishedAt ? `/p/${post.slug}` : `/write/${post.id}`}
                className="truncate font-medium hover:underline"
              >
                {post.title}
              </Link>
              <Badge variant={post.publishedAt ? "default" : "secondary"}>{post.publishedAt ? "Published" : "Draft"}</Badge>
            </div>
            {post.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/write/${post.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Edit
            </Link>
            <DeletePostButton id={post.id} />
          </div>
        </li>
      ))}
    </ul>
  );
}
