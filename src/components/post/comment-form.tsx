"use client";

import { useActionState } from "react";
import { addComment } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ postId }: { postId: number }) {
  const [state, action, pending] = useActionState(addComment, undefined);
  const error = state?.errors?.body?.[0] ?? state?.message;

  return (
    // Remounting on each successful post clears the textarea; failed posts keep what was typed.
    <form key={state?.postedAt ?? "new"} action={action} className="grid gap-2">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="comment-body" className="sr-only">
        Add a comment
      </label>
      <Textarea
        id="comment-body"
        name="body"
        placeholder="Add to the conversation…"
        maxLength={2000}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "comment-error" : undefined}
      />
      <div className="flex items-center justify-between gap-4">
        <p id="comment-error" role={error ? "alert" : undefined} className="text-sm text-destructive">
          {error}
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Posting…" : "Comment"}
        </Button>
      </div>
    </form>
  );
}
