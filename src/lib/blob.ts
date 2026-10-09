/**
 * Vercel Blob helpers. The read-write token looks like vercel_blob_rw_<storeId>_<secret>,
 * and public files are served from https://<storeid>.public.blob.vercel-storage.com.
 * Knowing our exact host lets us accept only URLs from *our* store, not any Blob store.
 * (No "server-only": next.config.ts uses blobHost() too. It never exposes the secret.)
 */
export function blobHost(token = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const storeId = token?.split("_")[3];
  return storeId ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null;
}

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const avatarPrefix = (userId: number) => `avatars/${userId}/`;

// Images inside posts: bigger than avatars, still shrunk in the browser before upload.
export const POST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const POST_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const postImagePrefix = (userId: number) => `posts/${userId}/`;

/** True only for an https URL in our store, inside the given folder (e.g. this user's avatars). */
function isOwnBlobUrl(raw: string, prefix: string): boolean {
  const host = blobHost();
  if (!host) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname === host && url.pathname.startsWith(`/${prefix}`) && !url.search;
  } catch {
    return false;
  }
}

export const isOwnAvatarUrl = (raw: string, userId: number) => isOwnBlobUrl(raw, avatarPrefix(userId));
export const isOwnPostImageUrl = (raw: string, userId: number) => isOwnBlobUrl(raw, postImagePrefix(userId));
