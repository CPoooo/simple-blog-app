import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { listPublishedByTag } from "@/lib/posts";
import { normalizeTag } from "@/lib/tags";

export default function TagPage({ params }: { params: Promise<{ name: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <TagPosts params={params} />
      </Suspense>
    </main>
  );
}

async function TagPosts({ params }: { params: Promise<{ name: string }> }) {
  const raw = decodeURIComponent((await params).name);
  const name = normalizeTag(raw);
  // Only canonical names are real tags; /tag/Next%20JS isn't a second URL for #next-js.
  if (!name || name !== raw) notFound();

  const posts = await listPublishedByTag(name);

  return (
    <>
      <h1 className="text-center sm:text-left text-4xl font-semibold">#{name}</h1>
      <p className="mt-2 text-center sm:text-left text-muted-foreground">
        {posts.length === 0 ? "No published posts with this tag yet." : `${posts.length} ${posts.length === 1 ? "post" : "posts"}`}
      </p>
      <div className="mt-6 divide-y border-t">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </>
  );
}
