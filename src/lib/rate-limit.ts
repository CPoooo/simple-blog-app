import "server-only";
import { headers } from "next/headers";
import { and, count, eq, gt, inArray, lt } from "drizzle-orm";
import { authAttempts, getDb } from "@/db";

/** Best-effort client IP. Behind Vercel, x-forwarded-for's first entry is the real client. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** True if `key` has `max` or more attempts inside the window. */
export async function isLimited(key: string, max: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const [row] = await getDb()
    .select({ n: count() })
    .from(authAttempts)
    .where(and(eq(authAttempts.key, key), gt(authAttempts.createdAt, since)));
  return (row?.n ?? 0) >= max;
}

export async function recordAttempt(...keys: string[]) {
  const db = getDb();
  await db.insert(authAttempts).values(keys.map((key) => ({ key })));
  // Opportunistic cleanup keeps the table tiny without a cron job.
  await db.delete(authAttempts).where(lt(authAttempts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
}

export async function clearAttempts(...keys: string[]) {
  await getDb().delete(authAttempts).where(inArray(authAttempts.key, keys));
}
