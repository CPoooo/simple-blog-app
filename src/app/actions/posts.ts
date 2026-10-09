"use server";

import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, posts } from "@/db";
import { requireUser } from "@/lib/dal";
import { docToText, makeExcerpt, makeSlug, parseDoc, readingMinutes } from "@/lib/post-content";

export type PostFormState =
  | {
      errors?: Partial<Record<"title" | "content", string[]>>;
      message?: string;
      saved?: boolean;
    }
  | undefined;

const postSchema = z.object({
  title: z.string({ error: "Give your post a title" }).trim().min(1, "Give your post a title").max(120, "Keep the title under 120 characters"),
  content: z.string().max(200_000, "This post is too long"),
  intent: z.enum(["save", "publish", "unpublish"]),
});

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function parseId(raw: string): number | undefined | "invalid" {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : "invalid";
}

export async function savePost(_prev: PostFormState, formData: FormData): Promise<PostFormState> {
  // Authorization starts here, never trusted from the client.
  const user = await requireUser();

  const id = parseId(str(formData.get("id")));
  if (id === "invalid") return { message: "That post doesn't exist." };

  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const { title, content, intent } = parsed.data;

  const doc = parseDoc(content);
  if (!doc) return { errors: { content: ["Something is off with the post body. Try reloading the editor."] } };

  const text = docToText(doc);
  if (intent === "publish" && !text) return { errors: { content: ["Write something before publishing."] } };

  const fields = { title, content: doc, excerpt: makeExcerpt(text), readingMinutes: readingMinutes(text) };
  const db = getDb();

  if (id === undefined) {
    // Slug has a random suffix; retry in the (very unlikely) event it collides.
    for (let attempt = 0; attempt < 3; attempt++) {
      const [created] = await db
        .insert(posts)
        .values({ ...fields, authorId: user.id, slug: makeSlug(title), publishedAt: intent === "publish" ? new Date() : null })
        .onConflictDoNothing()
        .returning({ id: posts.id, slug: posts.slug });
      if (created) redirect(intent === "publish" ? `/p/${created.slug}` : `/write/${created.id}`);
    }
    return { message: "Couldn't save the post. Please try again." };
  }

  const [updated] = await db
    .update(posts)
    .set({
      ...fields,
      updatedAt: new Date(),
      // coalesce keeps the original publish date when re-publishing an already published post.
      ...(intent === "publish" ? { publishedAt: sql`coalesce(${posts.publishedAt}, now())` } : {}),
      ...(intent === "unpublish" ? { publishedAt: null } : {}),
    })
    .where(and(eq(posts.id, id), eq(posts.authorId, user.id)))
    .returning({ slug: posts.slug });

  if (!updated) return { message: "That post doesn't exist." };

  updateTag(`post:${updated.slug}`);
  if (intent === "publish") redirect(`/p/${updated.slug}`);
  return { saved: true, message: intent === "unpublish" ? "Moved back to drafts." : "Saved." };
}

export async function deletePost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = parseId(str(formData.get("id")));
  if (typeof id !== "number") return;

  const [deleted] = await getDb()
    .delete(posts)
    .where(and(eq(posts.id, id), eq(posts.authorId, user.id)))
    .returning({ slug: posts.slug });

  if (deleted) updateTag(`post:${deleted.slug}`);
  redirect("/me/posts");
}
