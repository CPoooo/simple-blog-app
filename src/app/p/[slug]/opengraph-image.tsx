import { ImageResponse } from "next/og";
import { getPublishedPost } from "@/lib/posts";
import { OG_SIZE, OgCard } from "@/lib/og-card";

export const alt = "Post preview";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The card Slack, iMessage, and X show when someone shares a post. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPublishedPost((await params).slug);
  if (!post) {
    return new ImageResponse(<OgCard eyebrow="404" title="This hole goes nowhere." footer="rabbit holes" />, size);
  }
  return new ImageResponse(
    <OgCard
      eyebrow={post.tags.length ? post.tags.map((t) => `#${t}`).join("  ") : "a rabbit hole"}
      title={post.title}
      footer={`@${post.author.username} · ${post.readingMinutes} min read`}
    />,
    size,
  );
}
