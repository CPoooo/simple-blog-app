"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FeedCard } from "@/components/feed/feed-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeedFilters, FeedPage } from "@/lib/feed";

/**
 * Infinite scroll for the home feed. Page 1 arrives server-rendered; the sentinel
 * near the bottom pulls the next page from /api/feed with the same filters.
 */
export function FeedStream({ initial, filters }: { initial: FeedPage; filters: FeedFilters }) {
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
      const qs = new URLSearchParams({ cursor, sort: filters.sort });
      if (filters.tag) qs.set("tag", filters.tag);
      if (filters.author) qs.set("author", filters.author);
      const res = await fetch(`/api/feed?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: FeedPage = await res.json();
      // De-dupe: under "Most liked", a like landing mid-scroll could re-order a post.
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
  }, [cursor, filters]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || status === "error") return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "600px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore, status]);

  return (
    <>
      <div className="divide-y border-y">
        {posts.map((post) => (
          <FeedCard key={post.id} post={post} />
        ))}
      </div>
      <div ref={sentinel} className="py-8 text-center" aria-live="polite">
        {status === "loading" && (
          <div className="grid gap-3 text-left">
            <Skeleton className="h-6 w-2/3" />
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
        {!cursor && <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>}
      </div>
    </>
  );
}
