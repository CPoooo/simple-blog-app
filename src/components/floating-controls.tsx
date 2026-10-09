"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Frosted-glass circle, iOS style. Shared by both buttons so they always match. */
const circle =
  "grid size-11 place-items-center rounded-full bg-background/70 text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-md transition-all duration-200 hover:bg-background/90 active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

const NO_BACK = new Set(["/", "/feed"]); // home screens: nothing to go back to

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Floating "back" (top-right, under the navbar) and "scroll to top" (bottom-right).
 * Back uses real browser history when we navigated here inside the site; if you
 * arrived from outside (shared link, new tab) it goes home instead of leaving the site.
 */
export function FloatingControls() {
  const pathname = usePathname();
  const router = useRouter();
  const [showTop, setShowTop] = useState(false);
  const firstPath = useRef<string | null>(null);
  const navigatedInSite = useRef(false);

  // Any client-side navigation after the first page means history.back() stays in the site.
  // A ref, not state: it's only read when the button is clicked, so it never needs a re-render.
  useEffect(() => {
    if (firstPath.current === null) firstPath.current = pathname;
    else if (pathname !== firstPath.current) navigatedInSite.current = true;
  }, [pathname]);

  function goBack() {
    // A reload, or arriving from another of our own pages, also has an in-site page behind it.
    let fromOurSite = false;
    try {
      fromOurSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
    } catch {}
    if (navigatedInSite.current || fromOurSite) router.back();
    else router.push("/");
  }

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShowTop(window.scrollY > 400);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll(); // check once on mount (e.g. a reload halfway down the page), via rAF like scrolling
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      {!NO_BACK.has(pathname) && (
        <button
          type="button"
          aria-label="Go back"
          title="Back"
          onClick={goBack}
          className={cn(circle, "back-fab fixed top-[4.5rem] right-4 z-30")}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
      )}

      <button
        type="button"
        aria-label="Back to top"
        title="Back to top"
        tabIndex={showTop ? 0 : -1}
        aria-hidden={!showTop}
        onClick={() => {
          window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
          // Keyboard users land at the top of the content, not lost mid-page.
          document.getElementById("main")?.focus({ preventScroll: true });
        }}
        className={cn(
          circle,
          "fixed right-4 bottom-4 z-40",
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
      >
        <ArrowUp className="size-5" aria-hidden />
      </button>
    </>
  );
}
