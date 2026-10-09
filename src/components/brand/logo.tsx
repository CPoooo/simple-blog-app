import { cn } from "@/lib/utils";

/**
 * Two ears disappearing into a hole. Drawn by hand-ish on a 32px grid: the
 * curves are deliberately a little uneven so it reads as a sketch, not an icon set.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)} fill="none">
      {/* the hole */}
      <ellipse cx="16" cy="24" rx="13.5" ry="5.2" fill="currentColor" />
      <path d="M3.4 23.2c2.1-3.1 7-4.9 12.9-4.9 5.6 0 10.6 1.7 12.6 4.6" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* left ear */}
      <path
        d="M12.4 23.4c-.9-5.2-2.3-10.8-1.2-15.6.7-3 2.9-3.6 3.8-.8 1 3.4.4 9.6.2 16.2"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12.7 10.2c.3 3.4.9 7 1 10.6" stroke="var(--primary)" strokeWidth="1.1" strokeLinecap="round" />
      {/* right ear, flopped a little */}
      <path
        d="M17.6 23.4c.1-4.6 1-9.2 3-12.9 1.6-2.9 3.9-2.6 3.3.4-.7 3.6-3 8-3.7 12.5"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M21.4 12.4c-1 2.6-1.8 5.4-2.2 8.4" stroke="var(--primary)" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-heading text-lg font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>
        Rabbit<span className="text-primary">·</span>Holes
      </span>
    </span>
  );
}
