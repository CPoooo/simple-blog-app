"use server";

import { eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, tags, userInterests } from "@/db";
import { requireUser } from "@/lib/dal";
import { normalizeTag } from "@/lib/tags";

const MAX_INTERESTS = 20;

/** Replaces your interests with the ticked tags. Only existing tags count; junk is ignored. */
export async function saveInterests(formData: FormData): Promise<void> {
  const user = await requireUser();
  const wanted = [
    ...new Set(
      formData
        .getAll("tag")
        .filter((v): v is string => typeof v === "string")
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ].slice(0, MAX_INTERESTS);

  const db = getDb();
  const found = wanted.length ? await db.select({ id: tags.id }).from(tags).where(inArray(tags.name, wanted)) : [];

  // One transaction: you never end up with half your old interests and half the new ones.
  await db.batch([
    db.delete(userInterests).where(eq(userInterests.userId, user.id)),
    ...(found.length ? [db.insert(userInterests).values(found.map((t) => ({ userId: user.id, tagId: t.id })))] : []),
  ]);
  redirect("/for-you");
}
