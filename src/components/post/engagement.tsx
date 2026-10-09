import Link from "next/link";
import { deleteComment } from "@/app/actions/engagement";
import { CommentForm } from "@/components/post/comment-form";
import { LikeButton } from "@/components/post/like-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { getComments, getLikeCount, hasLiked } from "@/lib/engagement";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Reads the session, so render it inside <Suspense>. */
export async function PostLikes({ postId }: { postId: number }) {
  const user = await getCurrentUser();
  const [count, liked] = await Promise.all([getLikeCount(postId), user ? hasLiked(postId, user.id) : false]);
  return <LikeButton postId={postId} initial={{ liked, count }} signedIn={user !== null} />;
}

/** Reads the session, so render it inside <Suspense>. */
export async function PostComments({ postId }: { postId: number }) {
  const [thread, user] = await Promise.all([getComments(postId), getCurrentUser()]);

  return (
    <section aria-labelledby="comments-heading" className="mt-12 border-t pt-8">
      <h2 id="comments-heading" className="mb-6 text-2xl font-semibold">
        Comments {thread.length > 0 && <span className="text-muted-foreground">({thread.length})</span>}
      </h2>

      {user ? (
        <CommentForm postId={postId} />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      {thread.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No comments yet. Be the first.</p>
      ) : (
        <ol className="mt-8 grid gap-6">
          {thread.map((c) => (
            <li key={c.id} className="grid gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <Link href={`/u/${c.author.username}`} className="font-medium hover:underline">
                    @{c.author.username}
                  </Link>
                  <span className="text-muted-foreground"> · {dateFormat.format(c.createdAt)}</span>
                </span>
                {user?.id === c.authorId && (
                  <form action={deleteComment}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="ghost" size="xs" aria-label="Delete your comment">
                      Delete
                    </Button>
                  </form>
                )}
              </div>
              {/* Plain text, escaped by React; pre-line keeps the commenter's line breaks. */}
              <p className="leading-7 whitespace-pre-line">{c.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
