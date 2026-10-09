import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Private or personal pages have nothing for a search engine.
    rules: { userAgent: "*", allow: "/", disallow: ["/write", "/me/", "/settings/", "/feed", "/api/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
