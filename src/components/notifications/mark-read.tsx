"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markAllRead } from "@/app/actions/notifications";

/**
 * Marks everything read once the page is actually on screen. Done from the client,
 * not during the server render: rendering a page should never change data (prefetches
 * would otherwise mark things read that nobody looked at).
 */
export function MarkAllRead({ unread }: { unread: number }) {
  const router = useRouter();
  useEffect(() => {
    if (unread === 0) return;
    markAllRead().then(() => router.refresh()); // refresh clears the header badge
  }, [unread, router]);
  return null;
}
