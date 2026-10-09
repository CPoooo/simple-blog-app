"use client";

import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAX_TAGS, normalizeTag } from "@/lib/tags";

export type TagOption = { name: string; posts: number };

const SHOWN = 6;

/** Splits "rust, next js, ocam" into the finished tags and the one being typed ("ocam"). */
function splitInput(value: string) {
  const parts = value.split(",");
  const current = parts.pop() ?? "";
  return { done: parts.map(normalizeTag).filter(Boolean), current };
}

/**
 * A plain comma-separated text field (so it still works as a normal form field)
 * with a combobox of existing tags: matches for what you're typing, or the most
 * popular tags when you haven't typed anything yet. Reusing existing tags keeps
 * #nextjs, #next-js and #next_js from all becoming separate topics.
 */
export function TagInput({
  value,
  onChange,
  options,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (next: string) => void;
  options: TagOption[];
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const { done, current } = splitInput(value);
  const query = normalizeTag(current);

  const suggestions = useMemo(() => {
    const available = options.filter((o) => !done.includes(o.name));
    if (!query) return available.slice(0, SHOWN); // already sorted most-used first
    const starts = available.filter((o) => o.name.startsWith(query));
    const contains = available.filter((o) => !o.name.startsWith(query) && o.name.includes(query));
    return [...starts, ...contains].slice(0, SHOWN);
  }, [options, done, query]);

  const full = done.length >= MAX_TAGS;
  const showList = open && !full && suggestions.length > 0;

  function pick(name: string) {
    onChange([...done, name].join(", ") + ", ");
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if ((e.key === "Enter" || e.key === "Tab") && current.trim() !== "") {
      // Only hijack Enter/Tab while a tag is half-typed; otherwise they keep their normal jobs.
      e.preventDefault();
      pick(suggestions[active].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id="tags"
        name="tags"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="nextjs, rust, lifting"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={query ? "Matching tags" : "Popular tags"}
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg bg-popover p-1 text-sm shadow-md ring-1 ring-foreground/10"
        >
          {!query && <li className="px-2 py-1 text-xs text-muted-foreground" aria-hidden>Popular on Rabbit Holes</li>}
          {suggestions.map((s, i) => (
            <li
              key={s.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s.name);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5",
                i === active && "bg-accent text-accent-foreground",
              )}
            >
              <span>#{s.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {s.posts} {s.posts === 1 ? "post" : "posts"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
