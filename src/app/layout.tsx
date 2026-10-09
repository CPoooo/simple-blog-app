import type { Metadata } from "next";
import { Suspense } from "react";
import { Atkinson_Hyperlegible, Caveat, Geist, Geist_Mono, Newsreader } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { FloatingControls } from "@/components/floating-controls";
import { BottomTabs, SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { READING_SCRIPT } from "@/lib/reading-prefs";
import { site } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif for headings only; body stays Geist for UI legibility.
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

// Handwriting, used sparingly for margin notes. A little goes a long way.
const caveat = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
});

// Designed by the Braille Institute for low-vision readers; an option in the reading panel.
const hyperlegible = Atkinson_Hyperlegible({
  variable: "--font-hyper",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { siteName: site.name, type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": [{ url: "/rss.xml", title: site.name }] } },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class on <html> before hydration, hence suppressHydrationWarning.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} ${caveat.variable} ${hyperlegible.variable} h-full antialiased`}
    >
      <head>
        {/* Reader preferences, applied before paint so a custom width/font never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: READING_SCRIPT }} />
      </head>
      {/* Bottom padding on phones so the tab bar never covers the end of the page. */}
      <body className="paper-grain min-h-full flex flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Skip to content
          </a>
          <SiteHeader />
          <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </div>
          <SiteFooter />
          <BottomTabs />
          {/* Reads the URL (usePathname), so it streams in after the shell instead of blocking prerender. */}
          <Suspense fallback={null}>
            <FloatingControls />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
