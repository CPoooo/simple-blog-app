"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { upload } from "@vercel/blob/client";
import { Bold, Code, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Loader2, Quote, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MAX_WIDTH = 1600; // wide enough for retina at the 672px column, small enough to load fast

/** Shrink big photos in the browser before upload. GIFs pass through untouched (keeps animation). */
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))), "image/webp", 0.82),
  );
}

function ToolbarButton({
  label,
  icon: Icon,
  active,
  onClick,
  disabled,
  spin,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  spin?: boolean;
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep the editor selection; a click on a button would otherwise blur it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon className={spin ? "animate-spin" : undefined} />
    </Button>
  );
}

// useEditor returns null until the client mounts (immediatelyRender: false), so hold the space.
export function PostEditorToolbar({ editor, userId }: { editor: Editor | null; userId: number }) {
  if (!editor) return <div className="h-11 border-b bg-muted/40" aria-hidden />;
  return <Toolbar editor={editor} userId={userId} />;
}

function Toolbar({ editor, userId }: { editor: Editor; userId: number }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const active = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive("bold"),
      italic: ctx.editor.isActive("italic"),
      h2: ctx.editor.isActive("heading", { level: 2 }),
      h3: ctx.editor.isActive("heading", { level: 3 }),
      bullet: ctx.editor.isActive("bulletList"),
      ordered: ctx.editor.isActive("orderedList"),
      quote: ctx.editor.isActive("blockquote"),
      code: ctx.editor.isActive("codeBlock"),
      link: ctx.editor.isActive("link"),
    }),
  });

  const chain = () => editor.chain().focus();

  function toggleLink() {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function insertImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That's not an image.");
      return;
    }
    setUploading(true);
    try {
      const image = await prepareImage(file);
      const ext = image.type === "image/gif" ? "gif" : image.type === "image/webp" ? "webp" : "png";
      // Straight to Blob; /api/post-image/upload only hands out a token for posts/<you>/.
      const blob = await upload(`posts/${userId}/image.${ext}`, image, {
        access: "public",
        handleUploadUrl: "/api/post-image/upload",
        contentType: image.type,
      });
      // Alt text: what a screen reader says instead of the picture.
      const alt = window.prompt("Describe the image for people who can't see it (alt text):", "") ?? "";
      editor.chain().focus().setImage({ src: blob.url, alt: alt.slice(0, 300) }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
      <ToolbarButton label="Bold" icon={Bold} active={active.bold} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton label="Italic" icon={Italic} active={active.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolbarButton label="Heading" icon={Heading2} active={active.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolbarButton label="Subheading" icon={Heading3} active={active.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <ToolbarButton label="Bullet list" icon={List} active={active.bullet} onClick={() => chain().toggleBulletList().run()} />
      <ToolbarButton label="Numbered list" icon={ListOrdered} active={active.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <ToolbarButton label="Quote" icon={Quote} active={active.quote} onClick={() => chain().toggleBlockquote().run()} />
      <ToolbarButton label="Code block" icon={Code} active={active.code} onClick={() => chain().toggleCodeBlock().run()} />
      <ToolbarButton label="Link" icon={Link2} active={active.link} onClick={toggleLink} />
      <ToolbarButton
        label={uploading ? "Uploading image…" : "Image"}
        icon={uploading ? Loader2 : ImageIcon}
        active={false}
        disabled={uploading}
        spin={uploading}
        onClick={() => fileInput.current?.click()}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose an image to insert"
        onChange={(e) => insertImage(e.target.files?.[0])}
      />
    </div>
  );
}
