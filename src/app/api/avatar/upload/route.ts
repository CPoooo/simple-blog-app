import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { AVATAR_MAX_BYTES, AVATAR_TYPES, avatarPrefix } from "@/lib/blob";
import { getSessionUserId } from "@/lib/session";

/**
 * Issues short-lived tokens so the browser can upload an avatar straight to Vercel Blob.
 * The file never passes through this server (no body-size limits, no bandwidth cost);
 * this route only decides who may upload what, and where.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const userId = await getSessionUserId();
        if (userId === null) throw new Error("Sign in to upload a photo.");
        // Each user can only ever write inside their own folder.
        if (!pathname.startsWith(avatarPrefix(userId))) throw new Error("You can only upload your own avatar.");
        return {
          allowedContentTypes: [...AVATAR_TYPES],
          maximumSizeInBytes: AVATAR_MAX_BYTES,
          addRandomSuffix: true, // a new URL per upload, so caches never show the old face
        };
      },
      // Saving the URL happens in the setAvatar Server Action instead of a completion
      // callback: Vercel can't call back to localhost, and this way it works everywhere.
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
