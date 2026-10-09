import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkAllRead } from "@/components/notifications/mark-read";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { requireUser } from "@/lib/dal";
import { listNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function NotificationsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <h1 className="text-center text-4xl font-semibold sm:text-left">Notifications</h1>
      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full" />}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const user = await requireUser();
  const items = await listNotifications(user.id);
  const unread = items.filter((n) => n.readAt === null).length;

  if (items.length === 0) {
    return (
      <p className="mt-10 text-center text-muted-foreground sm:text-left">
        Nothing yet. When someone likes, comments on, or follows your stuff, it shows up here.
      </p>
    );
  }

  return (
    <>
      <MarkAllRead unread={unread} />
      <ul className="mt-8 divide-y border-y">
        {items.map((n) => {
          const href = n.type === "follow" ? `/u/${n.actor.username}` : n.post ? `/p/${n.post.slug}` : "#";
          const verb = n.type === "like" ? "liked" : n.type === "comment" ? "commented on" : "followed you";
          return (
            <li key={n.id}>
              <Link href={href} className={cn("flex items-start gap-3 px-2 py-4 hover:bg-muted/50", n.readAt === null && "bg-primary/5")}>
                <UserAvatar username={n.actor.username} src={n.actor.avatarUrl} />
                <div className="min-w-0 flex-1 text-left">
                  <p className="leading-6">
                    <span className="font-medium">@{n.actor.username}</span> {verb}
                    {n.post && n.type !== "follow" && <span className="font-medium"> {n.post.title}</span>}
                  </p>
                  {n.comment && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">&ldquo;{n.comment.body}&rdquo;</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{when.format(n.createdAt)}</span>
                {n.readAt === null && <span className="sr-only">(new)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
