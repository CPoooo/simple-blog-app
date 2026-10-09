import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DeletePostButton } from "@/components/editor/delete-post-button";
import { PostEditor } from "@/components/editor/post-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { getOwnPost } from "@/lib/posts";

export const metadata: Metadata = { title: "Edit post" };

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <EditPost params={params} />
      </Suspense>
    </main>
  );
}

async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  // Someone else's post and a missing post look identical: both 404.
  const post = await getOwnPost(id, user.id);
  if (!post) notFound();

  return (
    <>
      <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <h1 className="text-3xl font-semibold">{post.publishedAt ? "Edit post" : "Edit draft"}</h1>
        <DeletePostButton id={post.id} />
      </div>
      <PostEditor
        post={{ id: post.id, title: post.title, content: post.content, published: post.publishedAt !== null, tags: post.tags }}
      />
    </>
  );
}
