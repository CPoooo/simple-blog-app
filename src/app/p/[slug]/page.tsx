import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublishedPost } from "@/lib/posts";
import { renderPostHtml } from "@/lib/post-content";

export default function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <Suspense fallback={<PostSkeleton />}>
        <Post params={params} />
      </Suspense>
    </main>
  );
}

async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const published = post.publishedAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(post.publishedAt)
    : null;

  return (
    <article>
      <header className="mb-10">
        <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          @{post.author.username}
          {published && ` · ${published}`} · {post.readingMinutes} min read
        </p>
      </header>
      {/* HTML is generated from a schema-validated Tiptap document, never raw user HTML. */}
      <div className="prose-post" dangerouslySetInnerHTML={{ __html: renderPostHtml(post.content) }} />
    </article>
  );
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
