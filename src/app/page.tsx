import Link from "next/link";
import { HoleCrossSection } from "@/components/landing/hole-cross-section";
import { buttonVariants } from "@/components/ui/button";
import { getPopularTags } from "@/lib/discover";
import { getLatestPosts } from "@/lib/posts";
import { site } from "@/lib/site";

// Signed-in visitors never see this page: the proxy sends them to /feed. So it can be fully
// prerendered from cached data (no cookies), and loads instantly for everyone new.

const roman = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii"];
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function Landing() {
  const [latest, topics] = await Promise.all([getLatestPosts(6), getPopularTags(16)]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="grid items-center gap-12 pt-16 pb-20 lg:grid-cols-[1.15fr_1fr] lg:pt-24">
        {/* Mobile convention used across the site: centered below `sm`, left-aligned above. */}
        <div className="text-center sm:text-left">
          <p className="font-hand text-2xl text-primary -rotate-2">est. 2026, in a terminal</p>
          <h1 className="mt-3 text-5xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl">
            Go deep on things{" "}
            <span className="relative inline-block whitespace-nowrap">
              nobody
              {/* hand-drawn underline that draws itself in */}
              <svg aria-hidden viewBox="0 0 200 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full text-primary">
                <path
                  d="M2 12 C 40 4, 80 15, 118 8 S 180 5, 198 10"
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray="1"
                  className="motion-safe:animate-draw"
                />
              </svg>
            </span>{" "}
            asked you to.
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-8 text-muted-foreground sm:mx-0">
            {site.name} is a small, hand-built blog for deep dives, half-baked theories, and two-week obsessions with languages
            you&apos;ll never use at work. It&apos;s my corner of the internet first, but the door&apos;s open.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-4 sm:justify-start">
            <Link href="/register" className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}>
              Start digging
            </Link>
            <Link href="/discover" className="group text-base font-medium underline decoration-primary/40 decoration-2 underline-offset-8 hover:decoration-primary">
              See what&apos;s down there <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <a href="/surprise" className="text-base font-medium text-muted-foreground underline decoration-dotted underline-offset-8 hover:text-foreground">
              or surprise me
            </a>
          </div>
        </div>
        <HoleCrossSection />
      </section>

      {/* ── A note from the person who dug this ───────────────── */}
      <section aria-labelledby="note-heading" className="mx-auto max-w-2xl py-16">
        <div className="relative -rotate-1 rounded-sm bg-card p-8 text-center sm:text-left shadow-[0_1px_0_var(--border),0_18px_40px_-24px_color-mix(in_oklch,var(--foreground)_35%,transparent)] ring-1 ring-border sm:p-10">
          {/* a strip of tape holding the note to the page */}
          <span aria-hidden className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rotate-2 bg-primary/15 backdrop-blur-sm" />
          <h2 id="note-heading" className="font-hand text-3xl text-primary">
            a note from the person who dug this
          </h2>
          <div className="mt-4 grid gap-4 font-heading text-lg leading-8">
            <p>
              Hey, I&apos;m {site.author}. I built this to get properly good at working with an AI agent in the terminal (it wrote a
              lot of the code, I said &ldquo;no, not like that&rdquo; a lot), and to have somewhere to put the stuff rattling around
              in my head.
            </p>
            <p>
              Rust, OCaml, agentic coding, baseball, ultramarathons, Goggins, ice baths and Wim Hof breathing, yoga nidra,
              metacognition, aliens, and whether the universe is one big consciousness that forgot it was one. You know, normal
              stuff.
            </p>
            <p>If you&apos;ve got a rabbit hole of your own, come dig. Smarter people roasting my takes is very much encouraged.</p>
          </div>
          <p className="mt-6 text-center font-hand text-3xl sm:text-right">{site.author}</p>
        </div>
      </section>

      {/* ── Contents: the latest posts, typeset like a book ───── */}
      <section aria-labelledby="contents-heading" className="grid gap-12 border-t py-16 lg:grid-cols-[14rem_1fr]">
        <div className="text-center sm:text-left">
          <h2 id="contents-heading" className="text-3xl font-semibold">
            Contents
          </h2>
          <p className="mt-2 text-muted-foreground">Fresh from the hole.</p>
          <p className="mt-6 hidden font-hand text-xl text-primary lg:block">(updated whenever someone hits publish)</p>
        </div>
        {latest.length === 0 ? (
          <p className="text-center text-muted-foreground sm:text-left">Nothing published yet. Somebody has to go first.</p>
        ) : (
          <ol className="grid gap-1">
            {latest.map((post, i) => (
              <li key={post.id}>
                <Link
                  href={`/p/${post.slug}`}
                  className="group flex items-baseline justify-center gap-3 rounded-md py-2.5 -mx-2 px-2 text-center hover:bg-muted/60 sm:justify-start sm:text-left"
                >
                  <span className="shrink-0 font-heading text-sm text-muted-foreground italic sm:w-8">{roman[i]}.</span>
                  <span className="font-heading text-xl leading-snug group-hover:underline decoration-primary/50 underline-offset-4">{post.title}</span>
                  {/* dotted leader, like a table of contents */}
                  <span aria-hidden className="mx-1 hidden min-w-8 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-border sm:block" />
                  <span className="hidden shrink-0 text-sm text-muted-foreground sm:block">
                    @{post.author.username} · {post.publishedAt ? shortDate.format(post.publishedAt) : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ── Index: topics, like the back of a book ────────────── */}
      {topics.length > 0 && (
        <section aria-labelledby="index-heading" className="grid gap-12 border-t py-16 lg:grid-cols-[14rem_1fr]">
          <div className="text-center sm:text-left">
            <h2 id="index-heading" className="text-3xl font-semibold">
              Index
            </h2>
            <p className="mt-2 text-muted-foreground">Pick a hole, any hole.</p>
          </div>
          <ul className="columns-1 gap-10 sm:columns-2">
            {topics.map((t) => (
              <li key={t.name} className="break-inside-avoid">
                <Link href={`/tag/${t.name}`} className="group flex items-baseline gap-2 py-1">
                  <span className="group-hover:text-primary">{t.name.replaceAll("-", " ")}</span>
                  <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.3em] border-b border-dotted border-border" />
                  <span className="text-sm text-muted-foreground tabular-nums">{t.posts}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── House rules ──────────────────────────────────────── */}
      <section aria-labelledby="rules-heading" className="border-t py-16">
        <h2 id="rules-heading" className="text-center text-3xl font-semibold sm:text-left">
          House rules
        </h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {[
            ["Write the thing.", "Drafts stay private until you hit publish. Nobody has to see the four rewrites."],
            ["Follow the weird ones.", "The best posts come from people unreasonably obsessed with one specific thing."],
            ["Argue nicely.", "Comments are for roasting ideas, not people. Be the smart friend, not the reply guy."],
          ].map(([title, body], i) => (
            <li key={title} className="flex flex-col items-center gap-2 text-center sm:grid sm:grid-cols-[auto_1fr] sm:items-start sm:gap-4 sm:text-left">
              <span aria-hidden className="font-heading text-6xl leading-none font-semibold text-primary/80">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-2 leading-7 text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Your turn ────────────────────────────────────────── */}
      <section className="border-t py-20 text-center">
        <p className="font-hand text-3xl text-primary">your turn</p>
        <h2 className="mx-auto mt-2 max-w-xl text-4xl font-semibold sm:text-5xl">What have you been unreasonably into lately?</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className={buttonVariants({ size: "lg", className: "h-11 px-5 text-base" })}>
            Start your own rabbit hole
          </Link>
          <Link href="/discover" className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-5 text-base" })}>
            Just browsing
          </Link>
        </div>
      </section>
    </main>
  );
}
