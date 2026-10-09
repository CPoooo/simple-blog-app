"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Bold, Code, Heading2, Heading3, Italic, Link2, List, ListOrdered, Quote, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function ToolbarButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep the editor selection; a click on a button would otherwise blur it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon />
    </Button>
  );
}

// useEditor returns null until the client mounts (immediatelyRender: false), so hold the space.
export function PostEditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return <div className="h-11 border-b bg-muted/40" aria-hidden />;
  return <Toolbar editor={editor} />;
}

function Toolbar({ editor }: { editor: Editor }) {
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
    </div>
  );
}
