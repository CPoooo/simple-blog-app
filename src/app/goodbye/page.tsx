import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function GoodbyePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <LogoMark className="size-16" />
      <p className="mt-6 font-hand text-2xl text-primary">thanks for digging with us</p>
      <h1 className="mt-2 text-4xl font-semibold">Your account is deleted.</h1>
      <p className="mt-3 text-muted-foreground">Everything you made here is gone for good. The door&apos;s always open if you come back.</p>
      <Link href="/" className={buttonVariants({ className: "mt-8" })}>
        Back to the front page
      </Link>
    </main>
  );
}
