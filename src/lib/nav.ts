/**
 * The "places to read": one list drives the desktop tab pill and the phone bottom bar,
 * so the two can never disagree. Pure data + logic (no React), easy to test.
 */
export type NavKey = "feed" | "following" | "for-you" | "discover" | "surprise";
export type NavItem = { key: NavKey; href: string; label: string; short: string; action?: true };

const FEED: NavItem = { key: "feed", href: "/feed", label: "Feed", short: "Feed" };
const FOLLOWING: NavItem = { key: "following", href: "/following", label: "Following", short: "Following" };
const FOR_YOU: NavItem = { key: "for-you", href: "/for-you", label: "For you", short: "For you" };
const DISCOVER: NavItem = { key: "discover", href: "/discover", label: "Discover", short: "Discover" };
// An action, not a place: it redirects to a random post, so it's never "active".
const SURPRISE: NavItem = { key: "surprise", href: "/surprise", label: "Surprise me", short: "Surprise", action: true };

export const navItems = (signedIn: boolean): NavItem[] =>
  signedIn ? [FEED, FOLLOWING, FOR_YOU, DISCOVER, SURPRISE] : [DISCOVER, FOR_YOU, SURPRISE];

/** "You are here": exact match or a sub-path (/discover?tag=x is still Discover; /p/x is no tab). */
export function isActive(pathname: string | null, item: NavItem): boolean {
  if (!pathname || item.action) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
