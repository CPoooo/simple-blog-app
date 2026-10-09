"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/post-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiscoverPage } from "@/lib/discover";

/**
 * Infinite scroll. The first page arrives server-rendered; when the sentinel near
 * the bottom scrolls into view we fetch the next page from /api/discover. The
 * "Load more" button is the same action for keyboard users and if the observer
 * never fires.
 */
export function DiscoverFeed({ initial, tag }: { initial: DiscoverPage; tag: string | null }) {
  const [posts, setPosts] = useState(initial.posts);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const inFlight = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    try {
      const qs = new URLSearchParams({ cursor, asOf: initial.asOf });
      if (tag) qs.set("tag", tag);
      const res = await fetch(`/api/discover?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: DiscoverPage = await res.json();
      // De-dupe defensively: a like landing mid-scroll can't show a post twice.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.posts.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }, [cursor, initial.asOf, tag]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || status === "error") return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), {
      rootMargin: "600px 0px", // start fetching well before the user hits the bottom
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore, status]);

  if (posts.length === 0) {
    return (
      <p className="mt-8 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        Nothing here yet. Go write the first one.
      </p>
    );
  }

  return (
    <>
      <div className="mt-6 divide-y border-t">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <div ref={sentinel} className="py-8 text-center" aria-live="polite">
        {status === "loading" && (
          <div className="grid gap-3 text-left">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
        {status === "error" && (
          <div className="grid justify-items-center gap-2">
            <p className="text-sm text-destructive">Couldn&apos;t load more posts.</p>
            <Button variant="outline" onClick={() => void loadMore()}>
              Try again
            </Button>
          </div>
        )}
        {status === "idle" && cursor && (
          <Button variant="ghost" onClick={() => void loadMore()}>
            Load more
          </Button>
        )}
        {!cursor && <p className="text-sm text-muted-foreground">You&apos;ve reached the end. Go touch grass (or write something).</p>}
      </div>
    </>
  );
}
