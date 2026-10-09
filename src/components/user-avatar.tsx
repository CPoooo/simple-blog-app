import Image from "next/image";
import { cn } from "@/lib/utils";

// Warm hues that sit nicely next to the terracotta accent (no neon greens/blues).
const HUES = [18, 32, 45, 85, 150, 200, 265, 330];

function hueFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

/**
 * The uploaded photo when there is one, otherwise a stable initial on a color
 * picked from the username. Decorative (alt=""): the name is always shown next to it.
 */
export function UserAvatar({ username, src, className }: { username: string; src?: string | null; className?: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={160}
        height={160}
        className={cn("inline-block size-9 shrink-0 rounded-full bg-muted object-cover", className)}
      />
    );
  }

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
