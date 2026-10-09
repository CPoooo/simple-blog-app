"use client";

import { deletePost } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";

export function DeletePostButton({ id }: { id: number }) {
  return (
    <form
      action={deletePost}
      onSubmit={(e) => {
        if (!window.confirm("Delete this post for good? This can't be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm">
        Delete
      </Button>
    </form>
  );
}
