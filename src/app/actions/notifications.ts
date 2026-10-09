"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getDb, notifications } from "@/db";
import { requireUser } from "@/lib/dal";

/** Called once the notifications page has been seen. Only ever touches your own rows. */
export async function markAllRead(): Promise<void> {
  const user = await requireUser();
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
}
