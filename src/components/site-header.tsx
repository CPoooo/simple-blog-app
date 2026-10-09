import { Suspense } from "react";
import Link from "next/link";
import { Bell, PenLine, Search } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/brand/logo";
import { NavTabs } from "@/components/nav/nav-tabs";
import { NavTabsView } from "@/components/nav/nav-tabs-view";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/dal";
import { unreadCount } from "@/lib/notifications";

/**
 * [logo]  [places to read: Feed · Following · For you · Discover | Surprise me]  [actions]
 * Places live in the middle (or the bottom bar on phones); everything on the right *does* something.
 */
export function SiteHeader() {
  return (
    <header className="site-chrome sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="shrink-0" aria-label="Rabbit Holes, home">
          <Wordmark />
        </Link>
        <Suspense fallback={<NavTabsView variant="top" signedIn={false} pathname={null} />}>
          <ReadingTabs variant="top" />
        </Suspense>
        <div className="flex shrink-0 items-center gap-1">
          <Link href="/search" aria-label="Search" className={buttonVariants({ variant: "ghost", size: "icon" })}>
            <Search />
          </Link>
          <ThemeToggle />
          <Suspense fallback={<Skeleton className="h-8 w-28" />}>
            <AccountNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

/** Phone-only bottom tab bar; mounted from the layout so it sits outside the header. */
export function BottomTabs() {
  return (
    <Suspense fallback={<NavTabsView variant="bottom" signedIn={false} pathname={null} />}>
      <ReadingTabs variant="bottom" />
    </Suspense>
  );
}

/** Which tabs you get depends on being signed in, so this reads the session (inside Suspense). */
async function ReadingTabs({ variant }: { variant: "top" | "bottom" }) {
  const user = await getCurrentUser();
  return <NavTabs variant={variant} signedIn={user !== null} />;
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
      <Link href="/write" aria-label="Write a post" className={buttonVariants({ variant: "ghost", className: "max-sm:size-8 max-sm:px-0" })}>
        <PenLine />
        <span className="max-sm:sr-only">Write</span>
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
