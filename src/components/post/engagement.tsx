import Link from "next/link";
import { deleteComment } from "@/app/actions/engagement";
import { BookmarkButton } from "@/components/post/bookmark-button";
import { CommentForm } from "@/components/post/comment-form";
import { LikeButton } from "@/components/post/like-button";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/dal";
import { getComments, getLikeCount, hasLiked, isBookmarked } from "@/lib/engagement";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** Like + save-for-later. Reads the session, so render it inside <Suspense>. */
export async function PostLikes({ postId }: { postId: number }) {
  const user = await getCurrentUser();
  const [count, liked, saved] = await Promise.all([
    getLikeCount(postId),
    user ? hasLiked(postId, user.id) : false,
    user ? isBookmarked(user.id, postId) : false,
  ]);
  return (
    <div className="flex items-center gap-2">
      <LikeButton postId={postId} initial={{ liked, count }} signedIn={user !== null} />
      <BookmarkButton postId={postId} initial={saved} signedIn={user !== null} />
    </div>
  );
}

/** Reads the session, so render it inside <Suspense>. */
export async function PostComments({ postId }: { postId: number }) {
  const [thread, user] = await Promise.all([getComments(postId), getCurrentUser()]);

  return (
    <section aria-labelledby="comments-heading" className="mt-12 border-t pt-8">
      <h2 id="comments-heading" className="mb-6 text-center sm:text-left text-2xl font-semibold">
        Comments {thread.length > 0 && <span className="text-muted-foreground">({thread.length})</span>}
      </h2>

      {user ? (
        <CommentForm postId={postId} />
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-center sm:text-left text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}

      {thread.length === 0 ? (
        <p className="mt-6 text-center sm:text-left text-sm text-muted-foreground">No comments yet. Be the first.</p>
      ) : (
        <ol className="mt-8 grid gap-6">
          {thread.map((c) => (
            <li key={c.id} className="grid gap-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-between">
                <span className="inline-flex items-center gap-2">
                  <UserAvatar username={c.author.username} src={c.author.avatarUrl} className="size-6 text-xs" />
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
