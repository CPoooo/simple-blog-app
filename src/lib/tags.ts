export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 30;

/** "Next JS!" -> "next-js". The one place a tag name is canonicalised. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Comma-separated user input -> clean, de-duplicated names (or a message to show). */
export function parseTags(raw: string): { tags: string[]; error?: string } {
  const tags = [...new Set(raw.split(",").map(normalizeTag).filter(Boolean))];
  if (tags.some((t) => t.length > MAX_TAG_LENGTH)) {
    return { tags, error: `Each tag can be at most ${MAX_TAG_LENGTH} characters` };
  }
  if (tags.length > MAX_TAGS) return { tags, error: `Use at most ${MAX_TAGS} tags` };
  return { tags };
}
