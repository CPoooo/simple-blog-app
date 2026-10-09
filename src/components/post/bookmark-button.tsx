"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { toggleBookmark } from "@/app/actions/bookmarks";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BookmarkButton({ postId, initial, signedIn }: { postId: number; initial: boolean; signedIn: boolean }) {
  const [confirmed, setConfirmed] = useState(initial);
  const [shown, flip] = useOptimistic(confirmed, (s: boolean) => !s);
  const [, startTransition] = useTransition();
  const icon = <Bookmark className={cn("transition-colors", shown && "fill-primary text-primary")} />;

  if (!signedIn) {
    return (
      <Link href="/login" className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Sign in to save this post">
        {icon}
      </Link>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-pressed={shown}
      aria-label={shown ? "Remove from reading list" : "Save to reading list"}
      title={shown ? "Saved" : "Save for later"}
      onClick={() =>
        startTransition(async () => {
          flip(undefined);
          const result = await toggleBookmark(postId);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          startTransition(() => setConfirmed(result.bookmarked));
          toast.success(result.bookmarked ? "Saved to your reading list." : "Removed from your reading list.");
        })
      }
    >
      {icon}
    </Button>
  );
}
