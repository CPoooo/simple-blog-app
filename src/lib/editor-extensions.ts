import StarterKit from "@tiptap/starter-kit";

// One extension set shared by the browser editor, the server-side validator, and
// the server-side HTML renderer. If these ever drift, saved posts stop round-tripping.
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: {
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
  }),
];
