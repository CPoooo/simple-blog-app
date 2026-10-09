import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { LikeButton } from "@/components/post/like-button";
import { TagList } from "@/components/tag-list";
import { UserAvatar } from "@/components/user-avatar";
import type { FeedPost } from "@/lib/feed";

const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * A post in the home feed, timeline style: who, when, what, and a like button right
 * there so you don't have to open the post to show some love. Rendered by a client
 * list, so no server-only imports here.
 */
export function FeedCard({ post }: { post: FeedPost }) {
  const profile = `/u/${post.author.username}`;
  return (
    <article className="flex gap-3 py-5 sm:gap-4">
      <Link href={profile} className="shrink-0" tabIndex={-1} aria-hidden>
        <UserAvatar username={post.author.username} src={post.author.avatarUrl} className="size-10" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Link href={profile} className="font-medium hover:underline">
            @{post.author.username}
          </Link>
          <span className="text-muted-foreground">
            · <time dateTime={post.publishedAt}>{when.format(new Date(post.publishedAt))}</time> · {post.readingMinutes} min read
          </span>
        </p>
        <h2 className="mt-1 text-xl leading-snug font-semibold">
          <Link href={`/p/${post.slug}`} className="hover:underline">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && <p className="mt-1 line-clamp-3 text-muted-foreground">{post.excerpt}</p>}
        {post.tags.length > 0 && (
          <div className="mt-2 [&_ul]:justify-start">
            <TagList tags={post.tags} />
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <LikeButton postId={post.id} initial={{ liked: post.liked, count: post.likes }} signedIn />
          <Link
            href={`/p/${post.slug}#comments-heading`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`${post.comments} comments`}
          >
            <MessageCircle className="size-4" aria-hidden /> {post.comments}
          </Link>
        </div>
      </div>
    </article>
  );
}
