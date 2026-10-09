import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { TagList } from "@/components/tag-list";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export type PostCardData = {
  slug: string;
  title: string;
  excerpt: string;
  readingMinutes: number;
  // Date from a server query, ISO string from the discover JSON endpoint.
  publishedAt: Date | string | null;
  author: { username: string };
  tags: string[];
  likes?: number;
  comments?: number;
};

/** One post in a list (tag pages, discover). No server-only imports, so client lists can render it too. */
export function PostCard({ post }: { post: PostCardData }) {
  return (
    <article className="grid gap-2 py-6">
      <h2 className="text-2xl leading-snug font-semibold">
        <Link href={`/p/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h2>
      <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
        <span>@{post.author.username}</span>
        {post.publishedAt && <span>· {dateFormat.format(new Date(post.publishedAt))}</span>}
        <span>· {post.readingMinutes} min read</span>
        {post.likes !== undefined && (
          <span className="ml-2 inline-flex items-center gap-1" aria-label={`${post.likes} likes`}>
            <Heart className="size-3.5" aria-hidden /> {post.likes}
          </span>
        )}
        {post.comments !== undefined && (
          <span className="ml-1 inline-flex items-center gap-1" aria-label={`${post.comments} comments`}>
            <MessageCircle className="size-3.5" aria-hidden /> {post.comments}
          </span>
        )}
      </p>
      {post.excerpt && <p className="line-clamp-3 text-muted-foreground">{post.excerpt}</p>}
      <TagList tags={post.tags} />
    </article>
  );
}
