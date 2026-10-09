import Link from "next/link";
import { badgeVariants } from "@/components/ui/badge";

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>
          <Link href={`/tag/${tag}`} className={badgeVariants({ variant: "secondary" })}>
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
