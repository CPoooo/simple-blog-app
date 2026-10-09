import "server-only";
import { randomBytes } from "node:crypto";
import { getSchema, type JSONContent } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { generateHTML } from "@tiptap/html";
import { editorExtensions } from "@/lib/editor-extensions";

const schema = getSchema(editorExtensions);

export const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * Parses client-submitted JSON and checks it against our ProseMirror schema.
 * Unknown node/mark types or malformed structure throw inside fromJSON/check,
 * so only documents our editor could actually have produced get through.
 */
export function parseDoc(raw: string): JSONContent | null {
  try {
    const node = Node.fromJSON(schema, JSON.parse(raw));
    node.check();
    return node.toJSON() as JSONContent;
  } catch {
    return null;
  }
}

/** Plain text of a document, with a space between blocks. */
export function docToText(node: JSONContent): string {
  if (node.text) return node.text;
  const children = node.content ?? [];
  // Text runs inside one paragraph join seamlessly ("**bo**ld" is one word);
  // block-level children (paragraphs, list items...) get a space between them.
  const inline = children.some((c) => c.text !== undefined || c.type === "hardBreak");
  return children.map(docToText).join(inline ? "" : " ").trim();
}

/** Every image node in a document, anywhere in the tree. */
export function imagesOf(node: JSONContent): { src: string; alt: string }[] {
  const own = node.type === "image" ? [{ src: String(node.attrs?.src ?? ""), alt: String(node.attrs?.alt ?? "") }] : [];
  return [...own, ...(node.content ?? []).flatMap(imagesOf)];
}

export function makeExcerpt(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function slugify(title: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "post";
}

/** Readable slug plus a random suffix, so titles never collide and renames never break URLs. */
export function makeSlug(title: string): string {
  return `${slugify(title)}-${randomBytes(3).toString("hex")}`;
}

/** Only ever called on documents that already passed parseDoc, never on raw user HTML. */
export function renderPostHtml(doc: JSONContent): string {
  return generateHTML(doc, editorExtensions);
}
