"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadPrefs, READING_DEFAULTS, savePrefs, type ReadingPrefs } from "@/lib/reading-prefs";

type Choice<K extends keyof ReadingPrefs> = { value: ReadingPrefs[K]; label: string; hint?: string };

const GROUPS: { [K in keyof ReadingPrefs]: { label: string; choices: Choice<K>[] } } = {
  width: {
    label: "Page width",
    choices: [
      { value: "narrow", label: "Narrow" },
      { value: "comfy", label: "Comfy" },
      { value: "wide", label: "Wide" },
      { value: "full", label: "Full" },
    ],
  },
  size: {
    label: "Text size",
    choices: [
      { value: "s", label: "A", hint: "Small" },
      { value: "m", label: "A", hint: "Medium" },
      { value: "l", label: "A", hint: "Large" },
      { value: "xl", label: "A", hint: "Extra large" },
    ],
  },
  leading: {
    label: "Line spacing",
    choices: [
      { value: "compact", label: "Compact" },
      { value: "normal", label: "Normal" },
      { value: "airy", label: "Airy" },
    ],
  },
  font: {
    label: "Font",
    choices: [
      { value: "serif", label: "Serif" },
      { value: "sans", label: "Sans" },
      { value: "hyper", label: "Hyperlegible", hint: "Designed for low-vision readers" },
    ],
  },
  tint: {
    label: "Paper",
    choices: [
      { value: "none", label: "Default" },
      { value: "sepia", label: "Sepia" },
      { value: "contrast", label: "High contrast" },
    ],
  },
  focus: {
    label: "Focus mode",
    choices: [
      { value: "off", label: "Off" },
      { value: "on", label: "On", hint: "Hides the header, footer, and comments" },
    ],
  },
};

const SIZE_PREVIEW: Record<string, string> = { s: "text-xs", m: "text-sm", l: "text-base", xl: "text-lg" };

/**
 * The "Aa" reading panel. Floating so it's reachable mid-article (and in focus mode,
 * where the header is hidden). Choices save to localStorage and apply instantly.
 */
export function ReadingSettings() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<ReadingPrefs>(READING_DEFAULTS);
  const panelId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function toggle() {
    // Read storage when opening, not during render: keeps server and client markup identical.
    if (!open) setPrefs(loadPrefs());
    setOpen(!open);
  }

  function choose<K extends keyof ReadingPrefs>(key: K, value: ReadingPrefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
  }

  // Close on Escape or a click outside, and hand focus back to the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={trigger}
        variant="outline"
        aria-label="Reading settings"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="fab-aa fixed right-4 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-50 size-11 md:bottom-[4.25rem] rounded-full bg-background/70 font-heading text-lg shadow-lg ring-1 ring-foreground/10 backdrop-blur-md"
      >
        Aa
      </Button>

      {open && (
        <div
          ref={panel}
          id={panelId}
          role="dialog"
          aria-label="Reading settings"
          className="fixed right-4 bottom-[calc(11.5rem+env(safe-area-inset-bottom))] z-50 max-h-[calc(100dvh-14rem)] md:bottom-32 md:max-h-[calc(100dvh-10rem)] w-[min(21rem,calc(100vw-2rem))] overflow-y-auto rounded-xl bg-popover p-4 text-popover-foreground shadow-xl ring-1 ring-foreground/10"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="font-hand text-2xl text-primary">make it cozy</p>
            <Button variant="ghost" size="icon-sm" aria-label="Close reading settings" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>

          <div className="grid gap-4">
            {(Object.keys(GROUPS) as (keyof ReadingPrefs)[]).map((key) => {
              const group = GROUPS[key];
              const labelId = `${panelId}-${key}`;
              return (
                <div key={key} className="grid gap-1.5">
                  <p id={labelId} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </p>
                  <div role="radiogroup" aria-labelledby={labelId} className="flex rounded-lg bg-muted p-0.5">
                    {group.choices.map((c) => {
                      const checked = prefs[key] === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          aria-label={c.hint && key === "size" ? c.hint : undefined}
                          title={c.hint}
                          onClick={() => choose(key, c.value as never)}
                          className={cn(
                            "flex-1 rounded-md px-2 py-1.5 text-sm transition-colors",
                            checked ? "bg-background font-medium shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                            key === "size" && SIZE_PREVIEW[c.value],
                            key === "font" && c.value === "serif" && "font-heading",
                            key === "font" && c.value === "hyper" && "font-[family-name:var(--font-hyper)]",
                          )}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">Saved on this device.</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPrefs(READING_DEFAULTS);
                savePrefs(READING_DEFAULTS);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
