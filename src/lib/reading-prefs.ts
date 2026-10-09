/**
 * Reader preferences for post pages: width, size, spacing, font, tint, focus.
 *
 * Stored in localStorage (works for guests, costs the server nothing) and applied as
 * data-read-* attributes on <html>. CSS in globals.css maps those attributes to
 * variables. A tiny inline script applies them before first paint, so there's no
 * flash of the default layout (same trick next-themes uses for dark mode).
 */
export const READING_KEY = "rh-reading";

export const READING_OPTIONS = {
  width: ["narrow", "comfy", "wide", "full"],
  size: ["s", "m", "l", "xl"],
  leading: ["compact", "normal", "airy"],
  font: ["serif", "sans", "hyper"],
  tint: ["none", "sepia", "contrast"],
  focus: ["off", "on"],
} as const;

type Options = typeof READING_OPTIONS;
export type ReadingPrefs = { [K in keyof Options]: Options[K][number] };

export const READING_DEFAULTS: ReadingPrefs = {
  width: "comfy",
  size: "m",
  leading: "normal",
  font: "sans",
  tint: "none",
  focus: "off",
};

/** Whatever is stored, keep only values we know (old/garbage entries fall back to defaults). */
export function sanitize(raw: unknown): ReadingPrefs {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...READING_DEFAULTS };
  for (const key of Object.keys(READING_OPTIONS) as (keyof Options)[]) {
    const allowed = READING_OPTIONS[key] as readonly string[];
    if (typeof input[key] === "string" && allowed.includes(input[key] as string)) {
      (out as Record<string, string>)[key] = input[key] as string;
    }
  }
  return out;
}

export function loadPrefs(): ReadingPrefs {
  try {
    return sanitize(JSON.parse(localStorage.getItem(READING_KEY) ?? "{}"));
  } catch {
    return { ...READING_DEFAULTS }; // private mode / blocked storage: just use defaults
  }
}

export function applyPrefs(prefs: ReadingPrefs) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(prefs)) root.setAttribute(`data-read-${key}`, value);
}

export function savePrefs(prefs: ReadingPrefs) {
  applyPrefs(prefs);
  try {
    localStorage.setItem(READING_KEY, JSON.stringify(prefs));
  } catch {
    // storage blocked: the change still applies for this page view
  }
}

/** Runs in <head> before paint. Generated from READING_OPTIONS so the two can't drift. */
export const READING_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(
  READING_KEY,
)})||"{}"),o=${JSON.stringify(READING_OPTIONS)},d=document.documentElement;for(var k in o){if(o[k].indexOf(p[k])>-1)d.setAttribute("data-read-"+k,p[k])}}catch(e){}})();`;
