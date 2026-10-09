"use client";

import { usePathname } from "next/navigation";
import { NavTabsView } from "@/components/nav/nav-tabs-view";

/** The reading tabs with the current page highlighted. Render inside <Suspense> (usePathname). */
export function NavTabs({ variant, signedIn }: { variant: "top" | "bottom"; signedIn: boolean }) {
  return <NavTabsView variant={variant} signedIn={signedIn} pathname={usePathname()} />;
}
