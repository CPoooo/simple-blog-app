import type { Metadata } from "next";
import { Suspense } from "react";
import { PostEditor } from "@/components/editor/post-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";

export const metadata: Metadata = { title: "New post" };

export default function WritePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-8 text-center sm:text-left text-3xl font-semibold">New post</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NewPostEditor />
      </Suspense>
    </main>
  );
}

async function NewPostEditor() {
  await requireUser();
  return <PostEditor />;
}
