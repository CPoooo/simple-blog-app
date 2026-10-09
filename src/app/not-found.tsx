import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <LogoMark className="size-16 text-foreground" />
      <p className="mt-6 font-hand text-2xl text-primary">well, this is awkward</p>
      <h1 className="mt-2 text-4xl font-semibold">This page could not be found.</h1>
      <p className="mt-3 text-muted-foreground">
        This hole goes nowhere. The post might be a draft, deleted, or it never existed in the first place.
      </p>
      <div className="mt-8 flex gap-2">
        <Link href="/discover" className={buttonVariants()}>
          Find something good
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Go home
        </Link>
      </div>
    </main>
  );
}
