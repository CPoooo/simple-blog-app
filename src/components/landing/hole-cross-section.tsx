/**
 * A cross-section of a rabbit hole, drawn like a geology diagram: soil bands
 * get darker as you go down, a tunnel winds through them, and the depth notes
 * are written in the margin. The punchline at the bottom is the whole site.
 *
 * Colors are mixed from theme tokens, so the drawing re-inks itself in dark mode.
 */
const bands = [
  { y: 52, mix: 10, d: "M0 52 C 60 44, 120 60, 180 50 S 300 42, 360 54 V 140 H 0 Z" },
  { y: 130, mix: 17, d: "M0 132 C 80 122, 150 140, 220 128 S 320 120, 360 134 V 220 H 0 Z" },
  { y: 210, mix: 25, d: "M0 214 C 70 204, 160 222, 240 208 S 330 202, 360 216 V 300 H 0 Z" },
  { y: 290, mix: 34, d: "M0 292 C 90 282, 170 302, 250 288 S 330 282, 360 296 V 380 H 0 Z" },
  { y: 370, mix: 45, d: "M0 372 C 80 364, 170 382, 260 368 S 330 364, 360 376 V 460 H 0 Z" },
];

// Placed on whichever side the tunnel isn't at that depth; widths budgeted at ~6.3px/char (Caveat @ 15px).
const notes = [
  { x: 176, y: 92, text: "surface: closures?" },
  { x: 170, y: 178, text: "2 hrs: reading the spec" },
  { x: 8, y: 262, text: "6 hrs: my own interpreter" },
  { x: 154, y: 338, text: "3am: it's OCaml now" },
  { x: 150, y: 440, text: "the bottom: a blog post" },
];

export function HoleCrossSection() {
  return (
    <figure className="relative mx-auto w-full max-w-md">
      <svg viewBox="0 0 360 465" className="w-full" role="img" aria-labelledby="hole-title">
        <title id="hole-title">
          A cross-section of a rabbit hole. It starts at &quot;how do closures work?&quot; and ends, many hours later, at a
          blog post.
        </title>
        {/* grass line */}
        <path d="M0 52 C 60 44, 120 60, 180 50 S 300 42, 360 54" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {bands.map((b) => (
          <path key={b.y} d={b.d} style={{ fill: `color-mix(in oklch, var(--primary) ${b.mix}%, var(--background))` }} />
        ))}
        {/* little pebbles, because dirt has pebbles */}
        {[
          [40, 110], [300, 160], [120, 250], [330, 330], [70, 410], [210, 180], [280, 400],
        ].map(([cx, cy]) => (
          <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="5" ry="3" style={{ fill: "color-mix(in oklch, var(--foreground) 18%, transparent)" }} />
        ))}
        {/* the tunnel: a fat stroke in the page color, so it reads as dug-out space */}
        <path
          d="M182 50 C 182 90, 120 110, 112 150 S 250 200, 240 240 S 110 280, 118 320 S 230 370, 220 410"
          fill="none"
          strokeWidth="22"
          strokeLinecap="round"
          style={{ stroke: "var(--background)" }}
        />
        <path
          d="M182 50 C 182 90, 120 110, 112 150 S 250 200, 240 240 S 110 280, 118 320 S 230 370, 220 410"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 6"
          strokeLinecap="round"
          opacity="0.5"
        />
        {/* ears at the entrance */}
        <g transform="translate(166 8)">
          <path d="M8 44c-1-12-3-25-.6-34 1.4-5 5-5.6 6.4-.6 1.6 6 .4 18 .3 32" fill="var(--background)" stroke="currentColor" strokeWidth="1.6" />
          <path d="M18 44c.4-10 2.4-20 6.6-27 3-5 7-4.4 6 .8-1.3 6.2-5.6 14.4-6.8 24" fill="var(--background)" stroke="currentColor" strokeWidth="1.6" />
        </g>
        {/* the punchline, circled by hand */}
        <ellipse cx="222" cy="435" rx="84" ry="18" fill="none" stroke="var(--primary)" strokeWidth="1.6" transform="rotate(-3 222 435)" />
        {notes.map((n) => (
          <text key={n.text} x={n.x} y={n.y} className="fill-foreground" style={{ fontFamily: "var(--font-hand)", fontSize: 15 }}>
            {n.text}
          </text>
        ))}
      </svg>
    </figure>
  );
}
