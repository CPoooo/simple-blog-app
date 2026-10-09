import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { POST_IMAGE_MAX_BYTES, POST_IMAGE_TYPES, postImagePrefix } from "@/lib/blob";
import { authenticate } from "@/lib/dal";

/**
 * Upload tokens for images inside posts. Same shape as /api/avatar/upload: the browser
 * uploads straight to Blob, this route only decides who may write what, and where.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const userId = (await authenticate())?.id ?? null;
        if (userId === null) throw new Error("Sign in to upload images.");
        if (!pathname.startsWith(postImagePrefix(userId))) throw new Error("You can only upload into your own folder.");
        return {
          allowedContentTypes: [...POST_IMAGE_TYPES],
          maximumSizeInBytes: POST_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 400 });
  }
}
