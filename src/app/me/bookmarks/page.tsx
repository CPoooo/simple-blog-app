import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PostCard } from "@/components/post-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/dal";
import { listBookmarks } from "@/lib/engagement";

export const metadata: Metadata = { title: "Reading list" };

export default function ReadingListPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-center text-4xl font-semibold sm:text-left">Reading list</h1>
      <p className="mt-2 text-center text-muted-foreground sm:text-left">Posts you saved for later. Only you can see this.</p>
      <Suspense fallback={<Skeleton className="mt-8 h-48 w-full" />}>
        <Saved />
      </Suspense>
    </main>
  );
}

async function Saved() {
  const user = await requireUser();
  const saved = await listBookmarks(user.id);

  if (saved.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
        <p className="font-heading text-xl">Nothing saved yet.</p>
        <p className="mt-2 text-muted-foreground">Hit the bookmark next to the like button on any post to save it here.</p>
        <Link href="/discover" className={buttonVariants({ className: "mt-5" })}>
          Find something to read
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 divide-y border-t">
      {saved.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
