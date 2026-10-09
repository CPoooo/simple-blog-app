import "server-only";
import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import { getDb, notifications } from "@/db";

type Kind = "like" | "comment" | "follow";
type Event = { recipientId: number; actorId: number; type: Kind; postId?: number; commentId?: number };

/** Nobody needs a notification about their own like/comment (the DB CHECK refuses it anyway). */
export async function notify(e: Event) {
  if (e.recipientId === e.actorId) return;
  await getDb().insert(notifications).values({
    userId: e.recipientId,
    actorId: e.actorId,
    type: e.type,
    postId: e.postId ?? null,
    commentId: e.commentId ?? null,
  });
}

/** Undo: unlike / unfollow takes the notification back, so toggling can't spam someone. */
export async function unnotify(e: Omit<Event, "commentId">) {
  const conditions: SQL[] = [
    eq(notifications.userId, e.recipientId),
    eq(notifications.actorId, e.actorId),
    eq(notifications.type, e.type),
  ];
  if (e.postId !== undefined) conditions.push(eq(notifications.postId, e.postId));
  await getDb().delete(notifications).where(and(...conditions));
}

/** Personal, so always read fresh (never cached on the server). */
export async function unreadCount(userId: number): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function listNotifications(userId: number, limit = 50) {
  return getDb().query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: desc(notifications.createdAt),
    limit,
    columns: { id: true, type: true, readAt: true, createdAt: true },
    with: {
      actor: { columns: { username: true, avatarUrl: true } },
      post: { columns: { slug: true, title: true } },
      comment: { columns: { body: true } },
    },
  });
}
