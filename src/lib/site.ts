/** Everything brand-ish lives here, so renaming the site is a one-file change. */
export const site = {
  name: "Rabbit Holes",
  tagline: "Go deep on things nobody asked you to.",
  description:
    "A small, hand-built blog for deep dives, half-baked theories, and two-week obsessions with languages you'll never use at work. Write, follow, and fall in.",
  author: "Cameron",
  repo: "https://github.com/CPoooo/simple-blog-app",
  /** Absolute origin for RSS, sitemap, and link previews. Vercel provides its production host automatically. */
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
};

export const absoluteUrl = (path: string) => new URL(path, site.url).toString();
