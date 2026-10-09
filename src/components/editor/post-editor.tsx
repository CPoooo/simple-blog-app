"use client";

import { useActionState, useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { toast } from "sonner";
import { savePost } from "@/app/actions/posts";
import { PostEditorToolbar } from "@/components/editor/toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { editorExtensions } from "@/lib/editor-extensions";

type PostEditorProps = {
  post?: { id: number; title: string; content: JSONContent; published: boolean };
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function PostEditor({ post }: PostEditorProps) {
  const [state, action, pending] = useActionState(savePost, undefined);
  const [title, setTitle] = useState(post?.title ?? "");
  const [content, setContent] = useState(() => JSON.stringify(post?.content ?? EMPTY_DOC));

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

  return (
    <form action={action} className="grid gap-6">
      {post && <input type="hidden" name="id" value={post.id} />}
      <input type="hidden" name="content" value={content} />

      {state?.message && !state.saved && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.message}
        </p>
      )}

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
          <PostEditorToolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
        {state?.errors?.content && (
          <p role="alert" className="text-sm text-destructive">
            {state.errors.content[0]}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" name="intent" value="save" variant="outline" disabled={pending}>
          {post?.published ? "Save changes" : "Save draft"}
        </Button>
        <Button type="submit" name="intent" value="publish" disabled={pending || !hasText}>
          {post?.published ? "Update & view" : "Publish"}
        </Button>
        {post?.published && (
          <Button type="submit" name="intent" value="unpublish" variant="ghost" disabled={pending}>
            Move to drafts
          </Button>
        )}
      </div>
    </form>
  );
}
