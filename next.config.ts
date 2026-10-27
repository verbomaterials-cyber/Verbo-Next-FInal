import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      // Content-hashed files: changing an audio creates a new URL.
      source: "/audio/optimized/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
};

export default nextConfig;
