import { Suspense } from "react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/dal";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          Blog
        </Link>
        <div className="flex items-center gap-2">
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
      <Link href="/me/posts" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
        @{user.username}
      </Link>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </>
  );
}
