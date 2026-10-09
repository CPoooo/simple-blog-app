"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      {/* On phones only the (decorative) avatar shows, so the button needs its own name. */}
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-2 pl-1" aria-label={`Account menu for @${username}`} />}>
        <UserAvatar username={username} src={avatarUrl} className="size-6 text-xs" />
        <span className="hidden sm:inline">@{username}</span>
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link href="/feed" />}>Your feed</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/following" />}>Following</DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/u/${username}`} />}>Your profile</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/me/posts" />}>My posts</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/me/bookmarks" />}>Reading list</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/profile" />}>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={() => startTransition(() => logout())}>
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
