"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { toggleFollow } from "@/app/actions/follows";
import { Button, buttonVariants } from "@/components/ui/button";

type FollowState = { following: boolean; followers: number };

export function FollowButton({
  userId,
  username,
  initial,
  signedIn,
  size = "default",
}: {
  userId: number;
  username: string;
  initial: FollowState;
  signedIn: boolean;
  size?: "default" | "sm";
}) {
  const [confirmed, setConfirmed] = useState(initial);
  const [shown, flip] = useOptimistic(confirmed, (s: FollowState) => ({
    following: !s.following,
    followers: s.followers + (s.following ? -1 : 1),
  }));
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Link href="/login" className={buttonVariants({ size })}>
        Follow
      </Link>
    );
  }

  return (
    <Button
      size={size}
      variant={shown.following ? "outline" : "default"}
      aria-pressed={shown.following}
      aria-label={shown.following ? `Unfollow @${username}` : `Follow @${username}`}
      onClick={() =>
        startTransition(async () => {
          flip(undefined);
          const result = await toggleFollow(userId);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          startTransition(() => setConfirmed(result));
        })
      }
    >
      {shown.following ? "Following" : "Follow"}
    </Button>
  );
}
