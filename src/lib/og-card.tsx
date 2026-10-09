// Shared layout for generated link-preview images (1200x630). Satori, which renders
// these, only supports flexbox and inline styles, hence no Tailwind here.

export const OG_SIZE = { width: 1200, height: 630 };

const PAPER = "#FAF8F5";
const INK = "#1C1917";
const TERRACOTTA = "#C2410C";
const MUTED = "#78716C";

function Ears() {
  return (
    <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="24" rx="13.5" ry="5.2" fill={INK} />
      <path d="M12.4 23.4c-.9-5.2-2.3-10.8-1.2-15.6.7-3 2.9-3.6 3.8-.8 1 3.4.4 9.6.2 16.2" fill={PAPER} stroke={INK} strokeWidth="1.4" />
      <path d="M17.6 23.4c.1-4.6 1-9.2 3-12.9 1.6-2.9 3.9-2.6 3.3.4-.7 3.6-3 8-3.7 12.5" fill={PAPER} stroke={INK} strokeWidth="1.4" />
    </svg>
  );
}

export function OgCard({ eyebrow, title, footer }: { eyebrow: string; title: string; footer: string }) {
  const size = title.length > 70 ? 56 : title.length > 40 ? 68 : 80;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: PAPER, color: INK, padding: 72 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, color: TERRACOTTA }}>
        <Ears />
        {eyebrow}
      </div>
      <div style={{ display: "flex", flex: 1, alignItems: "center", fontSize: size, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
        {title}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 28, color: MUTED }}>
        <span>{footer}</span>
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: INK, fontWeight: 700 }}>
          Rabbit Holes
          <span style={{ width: 180, height: 6, background: TERRACOTTA, borderRadius: 3, marginTop: 6 }} />
        </span>
      </div>
    </div>
  );
}
