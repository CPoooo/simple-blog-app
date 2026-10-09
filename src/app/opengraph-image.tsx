import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/lib/og-card";
import { site } from "@/lib/site";

export const alt = `${site.name}: ${site.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgCard eyebrow="a small, hand-built blog" title={site.tagline} footer="deep dives · half-baked theories" />, size);
}
