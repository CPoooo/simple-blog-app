import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Dices, Sparkles } from "lucide-react";
import { saveInterests } from "@/app/actions/interests";
import { PostCard } from "@/components/post-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/dal";
import { getInterests, pickableTags, recommend, type Pick } from "@/lib/recommend";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Something you'll like" };

type SearchParams = Promise<{ skip?: string | string[] }>;

/** ?skip=12,40,7: posts already shown this session, so "another one" never repeats. Capped. */
async function readSkip(searchParams: SearchParams): Promise<number[]> {
  const raw = (await searchParams).skip;
  if (typeof raw !== "string") return [];
  return [...new Set(raw.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(-30);
}

export default function ForYouPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-center font-hand text-2xl text-primary sm:text-left">picked just for you</p>
      <h1 className="mt-1 text-center text-4xl font-semibold sm:text-left">Something you&apos;ll like</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-72 w-full" />}>
        <ForYou searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ForYou({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
        <p className="font-heading text-xl">Tell us what you&apos;re into and we&apos;ll find you something.</p>
        <p className="mt-2 text-muted-foreground">Picks are based on the topics you choose, so it needs an account.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/register" className={buttonVariants()}>
            Create an account
          </Link>
          <a href="/surprise" className={buttonVariants({ variant: "outline" })}>
            <Dices aria-hidden /> Just surprise me
          </a>
        </div>
      </div>
    );
  }

  const skip = await readSkip(searchParams);
  const [mine, options, rec] = await Promise.all([getInterests(user.id), pickableTags(), recommend(user.id, skip)]);
  const hasPick = rec.basis === "interests" || rec.basis === "likes";

  return (
    <>
      {hasPick ? (
        <PickCard pick={rec.pick} basis={rec.basis} skip={skip} />
      ) : (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
          <p className="font-heading text-xl">
            {rec.basis === "none" ? "Pick a few topics below to get started." : "You've seen everything that matches your interests. Impressive."}
          </p>
          <p className="mt-2 text-muted-foreground">
            {rec.basis === "none"
              ? "Or like a couple of posts: we'll learn from those too."
              : "Add a few more topics, or let chaos decide."}
          </p>
          {rec.basis === "exhausted" && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/for-you" className={buttonVariants({ variant: "outline" })}>
                Start over
              </Link>
              <a href="/surprise" className={buttonVariants({ variant: "ghost" })}>
                <Dices aria-hidden /> Surprise me
              </a>
            </div>
          )}
        </div>
      )}

      {hasPick && rec.more.length > 0 && (
        <section aria-labelledby="more-heading" className="mt-12">
          <h2 id="more-heading" className="text-center text-sm font-medium tracking-wide text-muted-foreground uppercase sm:text-left">
            Also up your alley
          </h2>
          <div className="divide-y">
            {rec.more.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}

      {/* Interests: a plain form of checkbox chips, so it works without JavaScript too. */}
      <details open={mine.length === 0} className="group mt-12 rounded-xl border p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
          <span>
            Your interests{" "}
            <span className="text-muted-foreground">({mine.length ? mine.length : "none yet"})</span>
          </span>
          <span className="text-sm text-muted-foreground group-open:hidden">Edit</span>
        </summary>
        <form action={saveInterests} className="mt-4">
          <p className="text-sm text-muted-foreground">
            Pick the topics you want more of. {rec.basis === "likes" && "Until you do, we're going off the posts you've liked."}
          </p>
          <fieldset className="mt-4">
            <legend className="sr-only">Topics</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((t) => (
                <label
                  key={t.name}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors select-none hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
                >
                  <input type="checkbox" name="tag" value={t.name} defaultChecked={mine.includes(t.name)} className="sr-only" />#{t.name}
                  <span className="text-xs opacity-60">{t.posts}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 flex justify-center sm:justify-start">
            <Button type="submit">Save interests</Button>
          </div>
        </form>
      </details>
    </>
  );
}

function PickCard({ pick, basis, skip }: { pick: Pick; basis: "interests" | "likes"; skip: number[] }) {
  const another = `/for-you?skip=${[...skip, pick.id].join(",")}`;
  const reasons = [
    pick.matched.length > 0 &&
      `${basis === "interests" ? "Matches your interests" : "Like posts you've liked"}: ${pick.matched.map((t) => `#${t}`).join(", ")}`,
    pick.followed && `From @${pick.author.username}, who you follow`,
    pick.likes > 0 && `${pick.likes} ${pick.likes === 1 ? "person has" : "people have"} liked it`,
  ].filter(Boolean) as string[];

  return (
    <article className="mt-8 rounded-2xl bg-card p-6 shadow-[0_18px_40px_-24px_color-mix(in_oklch,var(--foreground)_35%,transparent)] ring-1 ring-border sm:p-8">
      <div className="flex items-center gap-3 text-sm">
        <UserAvatar username={pick.author.username} src={pick.author.avatarUrl} />
        <Link href={`/u/${pick.author.username}`} className="font-medium hover:underline">
          @{pick.author.username}
        </Link>
        <span className="text-muted-foreground">· {pick.readingMinutes} min read</span>
      </div>
      <h2 className="mt-4 text-3xl leading-tight font-semibold">
        <Link href={`/p/${pick.slug}`} className="hover:underline">
          {pick.title}
        </Link>
      </h2>
      {pick.excerpt && <p className="mt-3 leading-7 text-muted-foreground">{pick.excerpt}</p>}
      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Tags">
        {pick.tags.map((t) => (
          <li
            key={t}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs", pick.matched.includes(t) ? "border-primary text-primary" : "text-muted-foreground")}
          >
            #{t}
          </li>
        ))}
      </ul>

      {reasons.length > 0 && (
        <div className="mt-6 rounded-lg bg-muted/60 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="size-4 text-primary" aria-hidden /> Why we picked this
          </p>
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
            {reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/p/${pick.slug}`} className={buttonVariants({ size: "lg" })}>
          Read it
        </Link>
        <Link href={another} className={buttonVariants({ size: "lg", variant: "outline" })}>
          Show me another
        </Link>
      </div>
    </article>
  );
}
