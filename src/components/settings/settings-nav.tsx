import Link from "next/link";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/account", label: "Account" },
] as const;

export function SettingsNav({ current }: { current: (typeof tabs)[number]["href"] }) {
  return (
    <nav aria-label="Settings" className="mb-8 flex justify-center gap-1 border-b sm:justify-start">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
            t.href === current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
