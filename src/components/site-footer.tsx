import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="mx-auto grid max-w-5xl justify-items-center gap-8 px-4 py-12 text-center sm:grid-cols-[1fr_auto] sm:justify-items-stretch sm:text-left">
        <div className="max-w-sm">
          <div className="flex items-center justify-center gap-2 font-heading text-base font-semibold sm:justify-start">
            <LogoMark className="size-6" />
            {site.name}
          </div>
          {/* A colophon, like the back page of a book. */}
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Set in Newsreader and Geist. Built in a terminal, mostly by an AI agent being told &ldquo;no, not like
            that&rdquo; by a human with a questionable amount of coffee.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <Link href="/discover" className="text-muted-foreground hover:text-foreground">
            Discover
          </Link>
          <Link href="/search" className="text-muted-foreground hover:text-foreground">
            Search
          </Link>
          <Link href="/rss.xml" className="text-muted-foreground hover:text-foreground">
            RSS
          </Link>
          <a href={site.repo} className="text-muted-foreground hover:text-foreground" rel="noreferrer" target="_blank">
            Source on GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
