import { Suspense } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/dal";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
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

  return (
    <>
      <Link href="/write" className={buttonVariants({ variant: "ghost" })}>
        Write
      </Link>
      <AccountMenu username={user.username} avatarUrl={user.avatarUrl} />
    </>
  );
}
