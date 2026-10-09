"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, postTags, posts, tags } from "@/db";
import { requireUser } from "@/lib/dal";
import { docToText, makeExcerpt, makeSlug, parseDoc, readingMinutes } from "@/lib/post-content";
import { parseTags } from "@/lib/tags";

export type PostFormState =
  | {
      errors?: Partial<Record<"title" | "content" | "tags", string[]>>;
      message?: string;
      saved?: boolean;
    }
  | undefined;

const postSchema = z.object({
  title: z.string({ error: "Give your post a title" }).trim().min(1, "Give your post a title").max(120, "Keep the title under 120 characters"),
  content: z.string().max(200_000, "This post is too long"),
  tags: z.string().max(300, "That's a lot of tags"),
  intent: z.enum(["save", "publish", "unpublish"]),
});

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function parseId(raw: string): number | undefined | "invalid" {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : "invalid";
}

type Db = ReturnType<typeof getDb>;

/** Tag rows are shared and idempotent, so creating them outside the post's transaction is safe. */
async function upsertTags(db: Db, names: string[]): Promise<number[]> {
  if (names.length === 0) return [];
  const rows = await db
    .insert(tags)
    .values(names.map((name) => ({ name })))
    // DO NOTHING wouldn't return the rows that already exist; a no-op update does.
    .onConflictDoUpdate({ target: tags.name, set: { name: sql`excluded.name` } })
    .returning({ id: tags.id });
  return rows.map((r) => r.id);
}

/** Tag pages are cached per tag, so a change to a post must refresh every tag it had or has. */
function refreshCaches(slug: string, tagNames: string[]) {
  updateTag(`post:${slug}`);
  for (const name of new Set(tagNames)) updateTag(`tag:${name}`);
}

export async function savePost(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  // Authorization starts here, never trusted from the client.
  const user = await requireUser();

  const id = parseId(str(formData.get("id")));
  if (id === "invalid") return { message: "That post doesn't exist." };

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    tags: str(formData.get("tags")),
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { title, content, intent } = parsed.data;

  const { tags: tagNames, error: tagError } = parseTags(parsed.data.tags);
  if (tagError) return { errors: { tags: [tagError] } };

  const doc = parseDoc(content);
  if (!doc) return { errors: { content: ["Something is off with the post body. Try reloading the editor."] } };

  const text = docToText(doc);
  if (intent === "publish" && !text) return { errors: { content: ["Write something before publishing."] } };

  const fields = { title, content: doc, excerpt: makeExcerpt(text), readingMinutes: readingMinutes(text) };
  const db = getDb();
  const tagIds = await upsertTags(db, tagNames);

  if (id === undefined) {
    const slug = makeSlug(title);
    // One transaction: the post and its tag links land together or not at all.
    // The link rows find the new post by its (unique) slug, since its id doesn't exist yet.
    const newPostId = sql<number>`(select id from posts where slug = ${slug})`;
    let created: { id: number }[];
    try {
      [created] = await db.batch([
        db
          .insert(posts)
          .values({ ...fields, authorId: user.id, slug, publishedAt: intent === "publish" ? new Date() : null })
          .returning({ id: posts.id }),
        ...(tagIds.length ? [db.insert(postTags).values(tagIds.map((tagId) => ({ postId: newPostId, tagId })))] : []),
      ]);
    } catch {
      // A slug collision (same title + same 24-bit suffix) lands here and rolls everything back.
      return { message: "Couldn't save the post. Please try again." };
    }
    if (intent === "publish") refreshCaches(slug, tagNames);
    redirect(intent === "publish" ? `/p/${slug}` : `/write/${created[0].id}`);
  }

  // Ownership check first: the tag statements below are keyed by post id only.
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.authorId, user.id)),
    columns: { id: true, slug: true },
    with: { postTags: { with: { tag: { columns: { name: true } } } } },
  });
  if (!existing) return { message: "That post doesn't exist." };

  try {
    await db.batch([
      db
        .update(posts)
        .set({
          ...fields,
          updatedAt: new Date(),
          // coalesce keeps the original publish date when re-publishing an already published post.
          ...(intent === "publish" ? { publishedAt: sql`coalesce(${posts.publishedAt}, now())` } : {}),
          ...(intent === "unpublish" ? { publishedAt: null } : {}),
        })
        .where(and(eq(posts.id, id), eq(posts.authorId, user.id))),
      db.delete(postTags).where(eq(postTags.postId, id)),
      ...(tagIds.length ? [db.insert(postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })))] : []),
    ]);
  } catch {
    return { message: "Couldn't save the post. Please try again." };
  }

  refreshCaches(existing.slug, [...existing.postTags.map((l) => l.tag.name), ...tagNames]);
  if (intent === "publish") redirect(`/p/${existing.slug}`);
  return { saved: true, message: intent === "unpublish" ? "Moved back to drafts." : "Saved." };
}

export async function deletePost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = parseId(str(formData.get("id")));
  if (typeof id !== "number") return;

  const db = getDb();
  const existing = await db.query.posts.findFirst({
    where: and(eq(posts.id, id), eq(posts.authorId, user.id)),
    columns: { slug: true },
    with: { postTags: { with: { tag: { columns: { name: true } } } } },
  });

  if (existing) {
    await db.delete(posts).where(and(eq(posts.id, id), eq(posts.authorId, user.id)));
    refreshCaches(existing.slug, existing.postTags.map((l) => l.tag.name));
  }
  redirect("/me/posts");
}
