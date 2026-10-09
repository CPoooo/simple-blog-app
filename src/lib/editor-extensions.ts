import Image from "@tiptap/extension-image";
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
  // Block-level images only, never base64 blobs in the JSON. Where src may point
  // is enforced on save (our Blob store, the author's own folder).
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { loading: "lazy", decoding: "async" },
  }),
];
