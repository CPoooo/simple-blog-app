import type { NextConfig } from "next";
import { blobHost } from "./src/lib/blob";

// Avatars come from our own Vercel Blob store only; pinning the exact host keeps the
// image optimizer from being used as a free proxy for anyone else's files.
const avatarHost = blobHost();

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: avatarHost ? [{ protocol: "https", hostname: avatarHost, pathname: "/avatars/**" }] : [],
    qualities: [75], // required since Next 16
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
