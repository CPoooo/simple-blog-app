"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleLike } from "@/app/actions/engagement";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LikeState = { liked: boolean; count: number };

export function LikeButton({ postId, initial, signedIn }: { postId: number; initial: LikeState; signedIn: boolean }) {
  const [confirmed, setConfirmed] = useState(initial);
  // Flip immediately on click; React drops the optimistic value once the transition settles.
  const [shown, flip] = useOptimistic(confirmed, (s: LikeState) => ({ liked: !s.liked, count: s.count + (s.liked ? -1 : 1) }));
  const [, startTransition] = useTransition();

  const label = `${shown.count} ${shown.count === 1 ? "like" : "likes"}`;
  const heart = <Heart className={cn("transition-colors", shown.liked && "fill-primary text-primary")} />;

  if (!signedIn) {
    return (
      <Link href="/login" className={buttonVariants({ variant: "outline" })} aria-label={`${label}. Sign in to like`}>
        {heart}
        {shown.count}
      </Link>
    );
  }

  function onClick() {
    startTransition(async () => {
      flip(undefined);
      const result = await toggleLike(postId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      startTransition(() => setConfirmed(result));
    });
  }

  return (
    <Button variant="outline" onClick={onClick} aria-pressed={shown.liked} aria-label={shown.liked ? `Unlike (${label})` : `Like (${label})`}>
      {heart}
      {shown.count}
    </Button>
  );
}
