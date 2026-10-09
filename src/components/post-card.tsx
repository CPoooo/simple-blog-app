import Link from "next/link";
import { TagList } from "@/components/tag-list";
import type { PostSummary } from "@/lib/posts";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** One post in a list (tag page now; feed and discover next). */
export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="grid gap-2 py-6">
      <h2 className="text-2xl leading-snug font-semibold">
        <Link href={`/p/${post.slug}`} className="hover:underline">
          {post.title}
        </Link>
      </h2>
      <p className="text-sm text-muted-foreground">
        @{post.author.username}
        {post.publishedAt && ` · ${dateFormat.format(post.publishedAt)}`} · {post.readingMinutes} min read
      </p>
      {post.excerpt && <p className="line-clamp-3 text-muted-foreground">{post.excerpt}</p>}
      <TagList tags={post.tags} />
    </article>
  );
}
