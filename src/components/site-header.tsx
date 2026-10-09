import { Suspense } from "react";
import Link from "next/link";
import { Bell, Dices, Search } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/dal";
import { unreadCount } from "@/lib/notifications";

export function SiteHeader() {
  return (
    <header className="site-chrome sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
        <nav className="flex items-center gap-1">
          <Link href="/" className="mr-2" aria-label="Rabbit Holes, home">
            <Wordmark />
          </Link>
          <Link href="/discover" className={buttonVariants({ variant: "ghost" })}>
            Discover
          </Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/search" aria-label="Search" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <Search />
          </Link>
          {/* A plain link to a redirecting route: prefetching would pick (and cache) a post early. */}
          <a href="/surprise" aria-label="Surprise me: open a random post" title="Surprise me" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <Dices />
          </a>
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="h-8 w-28" />}>
            <AccountNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function AccountNav() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          Sign in
        </Link>
        <Link href="/register" className={buttonVariants()}>
          Get started
        </Link>
      </>
    );
  }

  const unread = await unreadCount(user.id);
  return (
    <>
      <Link href="/following" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
        Following
      </Link>
      <Link href="/write" className={buttonVariants({ variant: "ghost" })}>
        Write
      </Link>
      <Link
        href="/notifications"
        className={buttonVariants({ variant: "ghost", size: "icon", className: "relative" })}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell />
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
      <AccountMenu username={user.username} avatarUrl={user.avatarUrl} />
    </>
  );
}
