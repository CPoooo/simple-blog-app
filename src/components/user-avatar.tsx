import { cn } from "@/lib/utils";

// Warm hues that sit nicely next to the terracotta accent (no neon greens/blues).
const HUES = [18, 32, 45, 85, 150, 200, 265, 330];

function hueFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

/** No uploads yet, so a stable initial on a color picked from the username. */
export function UserAvatar({ username, className }: { username: string; className?: string }) {
  const hue = hueFor(username);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full font-heading text-base font-semibold select-none",
        className,
      )}
      style={{ backgroundColor: `oklch(0.88 0.06 ${hue})`, color: `oklch(0.32 0.08 ${hue})` }}
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}
