"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { removeAvatar, setAvatar } from "@/app/actions/avatar";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";

const SIZE = 512; // avatars render at 64px max; 512 covers 3x screens with room to spare

/**
 * Center-crop to a square and shrink in the browser, so a 12MB phone photo
 * becomes a ~50KB file before it ever leaves the device.
 */
async function toSquareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file); // respects EXIF rotation in modern browsers
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIZE, side);
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // WebP where the browser can encode it; Safari quietly falls back to PNG.
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))), "image/webp", 0.85),
  );
}

export function AvatarUploader({ userId, username, initialUrl }: { userId: number; username: string; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<"idle" | "uploading" | "removing">("idle");
  const input = useRef<HTMLInputElement>(null);
  const busy = status !== "idle";

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("That's not an image.");
      return;
    }
    setStatus("uploading");
    try {
      const image = await toSquareImage(file);
      const ext = image.type === "image/webp" ? "webp" : "png";
      // Straight to Blob; our /api/avatar/upload route only hands out a scoped token.
      const blob = await upload(`avatars/${userId}/avatar.${ext}`, image, {
        access: "public",
        handleUploadUrl: "/api/avatar/upload",
        contentType: image.type,
      });
      const saved = await setAvatar(blob.url);
      if ("error" in saved) throw new Error(saved.error);
      setUrl(saved.avatarUrl);
      toast.success("Looking good.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setStatus("idle");
      if (input.current) input.current.value = ""; // allow picking the same file again
    }
  }

  async function onRemove() {
    setStatus("removing");
    const result = await removeAvatar();
    if ("error" in result) toast.error(result.error);
    else {
      setUrl(null);
      toast.success("Photo removed.");
    }
    setStatus("idle");
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <UserAvatar username={username} src={url} className="size-20 text-4xl" />
      <div className="grid justify-items-center gap-2 sm:justify-items-start">
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
            {status === "uploading" ? "Uploading…" : url ? "Change photo" : "Upload photo"}
          </Button>
          {url && (
            <Button type="button" variant="ghost" disabled={busy} onClick={onRemove}>
              {status === "removing" ? "Removing…" : "Remove"}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">JPG, PNG, or WebP. We crop it square for you.</p>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a profile photo"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
