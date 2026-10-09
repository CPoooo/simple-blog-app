"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { toast } from "sonner";
import { savePost } from "@/app/actions/posts";
import { TagInput, type TagOption } from "@/components/editor/tag-input";
import { PostEditorToolbar } from "@/components/editor/toolbar";
import { ReadingSettings } from "@/components/post/reading-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { editorExtensions } from "@/lib/editor-extensions";
import { requestLeave, setLeaveGuard } from "@/lib/leave-guard";
import { parseTags } from "@/lib/tags";
import { cn } from "@/lib/utils";

type PostEditorProps = {
  post?: { id: number; title: string; content: JSONContent; published: boolean; tags: string[] };
  /** Existing tags, most-used first, for the suggestions dropdown. */
  tagOptions: TagOption[];
  /** The author, for the image upload folder (the server enforces it anyway). */
  userId: number;
  /** Shown in the preview byline, exactly like the real post page. */
  author: { username: string; avatarUrl: string | null };
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function PostEditor({ post, tagOptions, userId, author }: PostEditorProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(savePost, undefined);
  const [title, setTitle] = useState(post?.title ?? "");
  const [tagInput, setTagInput] = useState(post?.tags.join(", ") ?? "");
  const [content, setContent] = useState(() => JSON.stringify(post?.content ?? EMPTY_DOC));
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState({ html: "", minutes: 1 });

  const form = useRef<HTMLFormElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const nextInput = useRef<HTMLInputElement>(null);

  // ── Unsaved changes ────────────────────────────────────────────────────
  // "Dirty" = differs from the last saved version. The baseline moves forward after
  // each successful save (derived during render, React's pattern for state-from-results).
  const [baseline, setBaseline] = useState(() => ({ title, tags: tagInput, content }));
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.saved) setBaseline({ title, tags: tagInput, content });
  }
  const dirty = title !== baseline.title || tagInput !== baseline.tags || content !== baseline.content;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const saveLabel = post?.published ? "Save changes" : "Save draft";

  useEffect(() => {
    /** "Are you sure?" toast: save a draft and continue, leave anyway, or dismiss to keep editing. */
    const ask = (proceed: () => void, saveThenGoTo: string) => {
      if (!dirtyRef.current) return proceed();
      toast("Are you sure?", {
        id: "unsaved-post", // one at a time, however many links get clicked
        description: "You haven't saved this yet!",
        duration: 15000,
        action: {
          label: saveLabel,
          onClick: () => {
            if (nextInput.current) nextInput.current.value = saveThenGoTo; // server redirects there after saving
            form.current?.requestSubmit(saveButton.current);
            // requestSubmit snapshots the form synchronously; clear it so a failed save
            // (e.g. no title yet) can't make a later normal save navigate away.
            if (nextInput.current) nextInput.current.value = "";
          },
        },
        cancel: {
          label: "Leave anyway",
          onClick: () => {
            dirtyRef.current = false; // don't ask again (or trip the tab-close prompt) on the way out
            proceed();
          },
        },
      });
    };
    setLeaveGuard(ask);

    // Links anywhere on the page (navbar, tabs, footer...): catch them before Next's <Link> navigates.
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // leaving the site: the tab-close prompt covers it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page / #hash
      e.preventDefault();
      e.stopPropagation();
      ask(() => window.location.assign(url.href), url.pathname + url.search + url.hash);
    };
    // Closing the tab or reloading: browsers only allow their own built-in prompt here.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      setLeaveGuard(null);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      toast.dismiss("unsaved-post");
    };
  }, [saveLabel]);

  function cancel() {
    requestLeave(() => (window.history.length > 1 ? router.back() : router.push("/me/posts")), "/me/posts");
  }

  // ── Editor ─────────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: editorExtensions,
    content: post?.content ?? EMPTY_DOC,
    // Required for Next.js: render on the client only so SSR and hydration markup match.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-post min-h-80 px-4 py-3 outline-none",
        "aria-label": "Post body",
      },
    },
    onUpdate: ({ editor }) => setContent(JSON.stringify(editor.getJSON())),
  });

  // Lets us disable Publish on an empty body. Reads the doc directly instead of editor.getText():
  // during unmount / Strict Mode remounts the selector can run on an already-destroyed editor,
  // where destroy() has nulled editor.schema (which getText needs) but state.doc is still intact.
  const hasText = useEditorState({
    editor,
    selector: (ctx) => Boolean(ctx.editor?.state.doc.textContent.trim()),
  });

  useEffect(() => {
    if (state?.saved) toast.success(state.message ?? "Saved.");
  }, [state]);

  function showPreview() {
    // Same extensions as the server renderer, so this is the HTML readers will get.
    const text = editor?.state.doc.textContent ?? "";
    setPreview({ html: editor?.getHTML() ?? "", minutes: Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 220)) });
    setMode("preview");
  }

  const previewTags = parseTags(tagInput).tags.slice(0, 5);

  return (
    <form ref={form} action={action} className="grid gap-6">
      {post && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="content" value={content} />
      <input ref={nextInput} type="hidden" name="next" defaultValue="" />

      {/* Write | Preview */}
      <div role="tablist" aria-label="Editor mode" className="inline-flex justify-self-center rounded-lg bg-muted p-0.5 text-sm sm:justify-self-start">
        {(["write", "preview"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => (m === "preview" ? showPreview() : setMode("write"))}
            className={cn(
              "rounded-md px-4 py-1.5 capitalize",
              mode === m ? "bg-background font-medium shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {state?.message && !state.saved && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {/* The editor stays mounted (just hidden) during preview, so nothing is lost switching back. */}
      <div hidden={mode === "preview"} className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A title worth clicking"
            maxLength={120}
            autoComplete="off"
            aria-invalid={state?.errors?.title ? true : undefined}
            aria-describedby={state?.errors?.title ? "title-error" : undefined}
            className="h-11 text-lg"
          />
          {state?.errors?.title && (
            <p id="title-error" className="text-sm text-destructive">
              {state.errors.title[0]}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Body</Label>
          <div className="overflow-hidden rounded-lg border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <PostEditorToolbar editor={editor} userId={userId} />
            <EditorContent editor={editor} />
          </div>
          {state?.errors?.content && (
            <p role="alert" className="text-sm text-destructive">
              {state.errors.content[0]}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tags">Tags</Label>
          <TagInput value={tagInput} onChange={setTagInput} options={tagOptions} invalid={Boolean(state?.errors?.tags)} describedBy="tags-hint" />
          <p id="tags-hint" className={state?.errors?.tags ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {state?.errors?.tags?.[0] ?? "Up to 5, separated by commas. Pick an existing tag so your post shows up with similar ones."}
          </p>
        </div>
      </div>

      {mode === "preview" && (
        // .reading: the preview honours the reader's width/size/font/tint settings, like the real page.
        <section aria-label="Preview" className="reading">
          <p className="mb-8 rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
            Preview: this is exactly what readers will see. Nothing has been published.
          </p>
          <article className="mx-auto max-w-(--read-width)">
            <header className="mb-10 text-center sm:text-left">
              <h1 className="text-4xl leading-tight font-semibold sm:text-5xl">{title.trim() || "Untitled"}</h1>
              <div className="mt-6 flex items-center justify-center gap-3 text-left text-sm sm:justify-start">
                <UserAvatar username={author.username} src={author.avatarUrl} />
                <div>
                  <p className="font-medium">@{author.username}</p>
                  <p className="text-muted-foreground">Not published yet · {preview.minutes} min read</p>
                </div>
              </div>
            </header>
            {preview.html.replace(/<p><\/p>/g, "").trim() ? (
              <div className="prose-post" dangerouslySetInnerHTML={{ __html: preview.html }} />
            ) : (
              <p className="text-center text-muted-foreground italic">Nothing written yet.</p>
            )}
            {previewTags.length > 0 && (
              <ul className="mt-12 flex flex-wrap justify-center gap-1.5 border-t pt-6 sm:justify-start" aria-label="Tags">
                {previewTags.map((t) => (
                  <li key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                    #{t}
                  </li>
                ))}
              </ul>
            )}
          </article>
          <ReadingSettings />
        </section>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        <Button ref={saveButton} type="submit" name="intent" value="save" variant="outline" disabled={pending}>
          {saveLabel}
        </Button>
        <Button type="submit" name="intent" value="publish" disabled={pending || !hasText}>
          {post?.published ? "Update & view" : "Publish"}
        </Button>
        {post?.published && (
          <Button type="submit" name="intent" value="unpublish" variant="ghost" disabled={pending}>
            Move to drafts
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={cancel} disabled={pending} className="sm:ml-auto">
          Cancel
        </Button>
      </div>
    </form>
  );
}
