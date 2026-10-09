import "server-only";
import { del, list } from "@vercel/blob";
import { eq } from "drizzle-orm";
import type { JSONContent } from "@tiptap/core";
import { getDb, posts } from "@/db";
import { isOwnPostImageUrl, postImagePrefix } from "@/lib/blob";
import { imagesOf } from "@/lib/post-content";

/**
 * Post images live in Vercel Blob; Postgres only holds their URLs inside each post's
 * Tiptap JSON. These helpers delete files nothing points at anymore, so removing an
 * image from a post (or deleting the post) really removes the file.
 */

/** An upload this young might belong to an editor tab that hasn't saved yet. Leave it alone. */
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

/** Every image URL used anywhere in this author's posts, drafts included. */
async function imagesInUse(authorId: number): Promise<Set<string>> {
  const rows = await getDb().select({ content: posts.content }).from(posts).where(eq(posts.authorId, authorId));
  return new Set(rows.flatMap((r) => imagesOf(r.content as JSONContent).map((i) => i.src)));
}

/**
 * Deletes the given images unless another of the author's posts still uses them
 * (an image copy-pasted into a second post must survive the first one's deletion).
 * Only ever touches files in this author's own folder.
 */
export async function deleteUnusedPostImages(authorId: number, candidates: string[]): Promise<string[]> {
  const own = [...new Set(candidates)].filter((url) => isOwnPostImageUrl(url, authorId));
  if (own.length === 0) return [];
  const used = await imagesInUse(authorId);
  const doomed = own.filter((url) => !used.has(url));
  if (doomed.length) await del(doomed);
  return doomed;
}

/** Uploads that never made it into a saved post (inserted then removed, tab closed, ...). */
export async function sweepOrphanedPostImages(authorId: number): Promise<string[]> {
  const cutoff = Date.now() - ORPHAN_GRACE_MS;
  const { blobs } = await list({ prefix: postImagePrefix(authorId), limit: 1000 });
  const old = blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff).map((b) => b.url);
  return deleteUnusedPostImages(authorId, old);
}

/** Fire-and-forget wrapper for after(): cleanup failures are logged, never shown to the writer. */
export async function cleanUpPostImages(authorId: number, removed: string[]) {
  try {
    await deleteUnusedPostImages(authorId, removed);
    await sweepOrphanedPostImages(authorId);
  } catch (err) {
    console.error("post image cleanup failed", err);
  }
}
