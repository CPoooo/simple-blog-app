import Link from "next/link";
import { Compass, Dices, Home, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActive, navItems, type NavKey } from "@/lib/nav";

const ICONS: Record<NavKey, LucideIcon> = { feed: Home, following: Users, "for-you": Sparkles, discover: Compass, surprise: Dices };

/**
 * Pure render of the reading tabs, no hooks: used as-is for the Suspense fallback
 * (no active tab yet) and wrapped by NavTabs, which supplies the current path.
 */
export function NavTabsView({ variant, signedIn, pathname }: { variant: "top" | "bottom"; signedIn: boolean; pathname: string | null }) {
  const items = navItems(signedIn);
  const pages = items.filter((i) => !i.action);
  const actions = items.filter((i) => i.action);

  if (variant === "top") {
    return (
      <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
        <ul className="flex items-center gap-0.5 rounded-full bg-muted/70 p-1 text-sm">
          {pages.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-full px-3 py-1.5 transition-colors",
                    active ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {actions.map((item) => (
          // Plain <a>: prefetching a redirect would pick (and cache) a random post early.
          <a
            key={item.key}
            href={item.href}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Dices className="size-4" aria-hidden />
            {item.label}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="site-chrome fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = ICONS[item.key];
          const active = isActive(pathname, item);
          const cls = cn(
            "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
            item.action ? "font-medium text-primary" : active ? "font-medium text-primary" : "text-muted-foreground",
          );
          const inner = (
            <>
              <Icon className={cn("size-5", active && "fill-primary/15")} aria-hidden />
              <span>{item.short}</span>
            </>
          );
          return (
            <li key={item.key}>
              {item.action ? (
                <a href={item.href} aria-label={item.label} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
